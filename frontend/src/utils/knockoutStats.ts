/**
 * Más elegidos y Buscador de los cuadros que no son el del Mundial: eliminatorias sorteadas ronda a
 * ronda (Champions, Copa del Rey, playoffs de la NBA) y cuadros propios (competición personalizada
 * o torneo oficial). Todo es puro.
 *
 * En todos, la predicción guarda por ronda quién gana cada cruce (`customRounds`): un equipo está
 * en la lista de una ronda cuando la predicción lo hace pasarla. Se compara con el cuadro real de
 * esa misma competición.
 */
import type { KnockoutRound } from '../services/api';
import type { Match, PredictionSummary } from '../types/api';
import { percent, type RealStatus } from './bracketStats';
import { getCustomRoundTitle, getTotalRounds } from './customBracket';
import { bracketResults, firstRoundPairs } from './customBracketPrediction';
import { knockoutRoundTitle } from './knockoutDraw';

/** Una ronda del cuadro real. */
export interface FieldRound {
  title: string;
  /** La última: quien la gana es el campeón. */
  final: boolean;
  /** Equipos que la juegan de verdad, si ya se sabe. */
  teams: Set<string>;
  /** Equipos que ya la han pasado. */
  winners: Set<string>;
  /** Pasan sin jugar: no hay nada que elegir ni que acertar. */
  byes: Set<string>;
  /** Ya se han decidido todos sus cruces. */
  decided: boolean;
}

/** El cuadro real de la competición, ronda a ronda. */
export interface KnockoutField {
  rounds: FieldRound[];
  /** Ronda en la que cayó cada equipo eliminado. */
  eliminatedAt: Map<string, number>;
  /**
   * Cruces de la ronda en los que está (o estaría) el equipo, por su posición en la lista de
   * elecciones. Vacío si no juega esa ronda. Casi siempre es uno; en el play-in de la NBA, dos.
   */
  slots: (team: string, round: number) => number[];
}

/** Predicción de un participante con solo lo que ya se puede ver. */
export interface KnockoutEntry {
  /** Clave de la predicción, para abrirla en el visor. */
  id: string;
  name: string;
  userId: number | null;
  /** Por ronda, quién gana cada cruce; null en lo que aún no está cerrado o no se eligió. */
  picks: (string | null)[][];
}

/** Lo que hace falta del estado de cierre para saber qué elecciones se pueden mostrar. */
export interface PickVisibility {
  fullyLocked: boolean;
  lockedPicks: boolean[][];
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es');
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** «Cae en cuartos de final»; quien pierde la última ronda es el subcampeón. */
const fallLabel = (round: FieldRound, verb: 'Cae' | 'Cayó') =>
  round.final ? 'Subcampeón' : `${verb} en ${lowerFirst(round.title)}`;

/** Cuadro real de unas eliminatorias sorteadas ronda a ronda. */
export function fieldFromDraw(rounds: KnockoutRound[], series = false): KnockoutField {
  const lost: Map<string, number>[] = [];
  const pending: Set<string>[] = [];
  const fieldRounds = rounds.map((round, index): FieldRound => {
    const teams = new Set<string>();
    const winners = new Set<string>();
    lost[index] = new Map();
    pending[index] = new Set();
    for (const tie of round.ties) {
      const sides = [tie.home, tie.away].filter((team): team is string => Boolean(team));
      for (const team of sides) teams.add(team);
      if (!tie.winner) {
        for (const team of sides) pending[index].add(team);
        continue;
      }
      winners.add(tie.winner);
      for (const team of sides) if (team !== tie.winner) lost[index].set(team, index);
    }
    return {
      title: knockoutRoundTitle(round.round, series),
      final: round.round === 'final',
      teams,
      winners,
      byes: new Set(),
      decided: round.drawn && round.ties.length > 0 && round.ties.every((tie) => tie.winner),
    };
  });

  // Perder un cruce no siempre elimina (el play-in de la NBA da otra oportunidad): un equipo está
  // fuera cuando pierde en la última ronda en la que aparece y no le queda ningún cruce en ella.
  const eliminatedAt = new Map<string, number>();
  for (let index = fieldRounds.length - 1; index >= 0; index--) {
    for (const team of lost[index].keys()) {
      if (eliminatedAt.has(team)) continue;
      const later = fieldRounds.slice(index + 1).some((round) => round.teams.has(team));
      if (later || pending[index].has(team)) continue;
      // Ganó un cruce y perdió otro: está fuera solo si la ronda siguiente ya se sorteó sin él.
      if (fieldRounds[index].winners.has(team) && !rounds[index + 1]?.drawn) continue;
      eliminatedAt.set(team, index);
    }
  }
  const slots = (team: string, round: number) =>
    (rounds[round]?.ties ?? []).flatMap((tie, position) =>
      tie.home === team || tie.away === team ? [position] : [],
    );
  return { rounds: fieldRounds, eliminatedAt, slots };
}

/**
 * Cuadro real de un cuadro propio, con sus partidos por ronda («bracket-N»). `official` dice si
 * los cruces son los de un torneo oficial, que llegan ya en el orden en que se eligen.
 */
export function fieldFromMatches(matches: Match[], official = false): KnockoutField {
  const { realWinners, eliminatedAt, decidedRounds } = bracketResults(matches);
  const teams: Set<string>[] = [];
  const byes: Set<string>[] = [];
  for (const match of matches) {
    const found = /^bracket-(\d+)$/.exec(match.round ?? '');
    if (!found) continue;
    const index = Number(found[1]) - 1;
    teams[index] ??= new Set();
    byes[index] ??= new Set();
    if (match.home) teams[index].add(match.home);
    if (match.away_team_id && match.away) teams[index].add(match.away);
    else if (match.home) byes[index].add(match.home);
  }
  const total = getTotalRounds(matches.filter((match) => match.round === 'bracket-1').length);
  const rounds = Array.from({ length: total }, (_, index): FieldRound => {
    const passed = new Set([...(realWinners[index] ?? []), ...(byes[index] ?? [])]);
    return {
      title: getCustomRoundTitle(index, total),
      final: index === total - 1,
      teams: teams[index] ?? new Set(),
      winners: passed,
      byes: byes[index] ?? new Set(),
      decided: Boolean(decidedRounds[index]),
    };
  });
  // El cuadro es un árbol fijo: el ganador del cruce i juega en el cruce i/2 de la ronda siguiente.
  const firstSlot = new Map<string, number>();
  firstRoundPairs(matches, official).forEach((pair, position) => {
    for (const team of pair) if (team) firstSlot.set(team, position);
  });
  const slots = (team: string, round: number) => {
    const position = firstSlot.get(team);
    return position === undefined || round >= total ? [] : [Math.floor(position / 2 ** round)];
  };
  return { rounds, eliminatedAt, slots };
}

/**
 * Predicciones de la liga con solo las elecciones ya cerradas. El servidor oculta lo abierto de los
 * demás, pero la predicción propia llega entera: aquí se le aplica la misma regla, para que lo que
 * aún se puede cambiar no entre en ningún recuento.
 */
export function toKnockoutEntries(
  predictions: PredictionSummary[],
  lock: PickVisibility | null | undefined,
): KnockoutEntry[] {
  if (!lock) return [];
  return predictions.flatMap((prediction) => {
    const saved = prediction.data?.customRounds;
    if (!saved) return [];
    const picks = saved.map((row, round) =>
      (row ?? []).map((pick, index) =>
        pick && (lock.fullyLocked || lock.lockedPicks[round]?.[index]) ? pick : null,
      ),
    );
    if (!picks.some((row) => row.some(Boolean))) return [];
    return [
      {
        id: prediction.key,
        name: prediction.participantName || prediction.data?.user || 'Anónimo',
        userId: prediction.userId,
        picks,
      },
    ];
  });
}

const hasTeam = (entry: KnockoutEntry, round: number, team: string) =>
  Boolean(entry.picks[round]?.includes(team));

/** Predicciones con alguna elección visible en la ronda: son el total sobre el que se cuenta. */
const roundEntries = (entries: KnockoutEntry[], round: number) =>
  entries.filter((entry) => entry.picks[round]?.some(Boolean));

/** Rondas con algo que mostrar, en orden. */
export const visibleRounds = (entries: KnockoutEntry[], field: KnockoutField): number[] =>
  field.rounds.map((_, index) => index).filter((index) => roundEntries(entries, index).length > 0);

/** «Pasa de octavos de final», o «Campeón» en la última ronda. */
export const passLabel = (round: FieldRound) =>
  round.final ? 'Campeón' : `Pasa de ${lowerFirst(round.title)}`;

/** Predicciones con una elección visible en alguno de esos cruces de la ronda. */
const askedEntries = (entries: KnockoutEntry[], round: number, slots: Iterable<number>) => {
  const positions = [...slots];
  return entries.filter((entry) => positions.some((position) => entry.picks[round]?.[position]));
};

export interface TeamPick {
  team: string;
  count: number;
  /** Predicciones que eligieron en el cruce del equipo: sobre ellas va el porcentaje. */
  total: number;
  percent: number;
}

/**
 * Equipos más elegidos para pasar la ronda. Cada uno se cuenta sobre quienes eligieron en su cruce,
 * así que un cruce aún abierto no baja el porcentaje de los ya cerrados. Los que pasan sin jugar no
 * cuentan.
 */
export function rankRound(
  entries: KnockoutEntry[],
  field: KnockoutField,
  round: number,
): { total: number; picks: TeamPick[] } {
  const byes = field.rounds[round]?.byes ?? new Set<string>();
  const slots = new Map<string, Set<number>>();
  for (const entry of entries) {
    (entry.picks[round] ?? []).forEach((team, position) => {
      if (!team || byes.has(team)) return;
      const positions = slots.get(team) ?? new Set<number>();
      slots.set(team, positions.add(position));
    });
  }
  const picks = [...slots]
    .map(([team, positions]) => {
      const asked = askedEntries(entries, round, positions);
      const count = asked.filter((entry) => hasTeam(entry, round, team)).length;
      return { team, count, total: asked.length, percent: percent(count, asked.length) };
    })
    .sort((a, b) => b.count - a.count || b.percent - a.percent || byName(a.team, b.team));
  return { total: roundEntries(entries, round).length, picks };
}

/** Si el equipo pasó de verdad la ronda; `pending` mientras no se sabe. */
export function teamStatus(field: KnockoutField, team: string, round: number): RealStatus {
  const info = field.rounds[round];
  if (!info) return 'pending';
  if (info.winners.has(team)) return 'yes';
  const out = field.eliminatedAt.get(team);
  return info.decided || (out !== undefined && out <= round) ? 'no' : 'pending';
}

/** Cruces de la ronda ya decididos y cuántos acertó de media cada predicción. */
export function roundAccuracy(
  entries: KnockoutEntry[],
  field: KnockoutField,
  round: number,
): { average: number; size: number } | null {
  const info = field.rounds[round];
  const playing = roundEntries(entries, round);
  if (!info || playing.length === 0) return null;
  const real = [...info.winners].filter((team) => !info.byes.has(team));
  if (real.length === 0) return null;
  const hits = playing.reduce(
    (sum, entry) => sum + real.filter((team) => hasTeam(entry, round, team)).length,
    0,
  );
  return { average: hits / playing.length, size: real.length };
}

/** Equipos que pasaron la ronda sin que nadie de la liga los pusiera. */
export function roundSurprises(
  entries: KnockoutEntry[],
  field: KnockoutField,
  round: number,
): string[] {
  const info = field.rounds[round];
  const playing = roundEntries(entries, round);
  if (!info || playing.length === 0) return [];
  return [...info.winners]
    .filter((team) => !info.byes.has(team) && !playing.some((entry) => hasTeam(entry, round, team)))
    .sort(byName);
}

/** Equipos que alguien ha puesto en alguna ronda visible, por orden alfabético. */
export function pickedTeams(entries: KnockoutEntry[]): string[] {
  const teams = new Set<string>();
  for (const entry of entries) {
    for (const row of entry.picks) for (const team of row) if (team) teams.add(team);
  }
  return [...teams].sort(byName);
}

/** Atajos del buscador: los más elegidos en la ronda más avanzada que ya se ve. */
export function favouriteTeams(
  entries: KnockoutEntry[],
  field: KnockoutField,
  limit: number,
): string[] {
  const rounds = visibleRounds(entries, field);
  if (rounds.length === 0) return [];
  return rankRound(entries, field, rounds[rounds.length - 1])
    .picks.slice(0, limit)
    .map((pick) => pick.team);
}

export interface TeamRoundRow {
  round: number;
  count: number;
  total: number;
  percent: number;
  status: RealStatus;
}

/**
 * Cuántas predicciones hacen pasar al equipo cada ronda (el «embudo» del buscador). Solo salen las
 * rondas en las que su cruce ya tiene elecciones a la vista.
 */
export function teamRounds(
  entries: KnockoutEntry[],
  field: KnockoutField,
  team: string,
): TeamRoundRow[] {
  return field.rounds.flatMap((_, round) => {
    const asked = askedEntries(entries, round, field.slots(team, round));
    if (asked.length === 0) return [];
    const count = asked.filter((entry) => hasTeam(entry, round, team)).length;
    return [
      {
        round,
        count,
        total: asked.length,
        percent: percent(count, asked.length),
        status: teamStatus(field, team, round),
      },
    ];
  });
}

export interface RoundPickers {
  /** Quienes hacen pasar al equipo esa ronda. */
  yes: KnockoutEntry[];
  /** El resto de los que eligieron en su cruce, con la ronda en la que lo dejan fuera. */
  no: { entry: KnockoutEntry; note: string }[];
}

/** Quién hace pasar al equipo la ronda y dónde lo deja fuera el resto. */
export function roundPickers(
  entries: KnockoutEntry[],
  field: KnockoutField,
  team: string,
  round: number,
): RoundPickers {
  const byEntry = (a: KnockoutEntry, b: KnockoutEntry) => byName(a.name, b.name);
  const yes: KnockoutEntry[] = [];
  const no: { entry: KnockoutEntry; note: string; fall: number }[] = [];
  for (const entry of askedEntries(entries, round, field.slots(team, round))) {
    if (hasTeam(entry, round, team)) {
      yes.push(entry);
      continue;
    }
    // La primera ronda en la que eligió en el cruce del equipo y puso al rival.
    let fall = round;
    for (let index = 0; index < round; index++) {
      const asked = askedEntries([entry], index, field.slots(team, index)).length > 0;
      if (asked && !hasTeam(entry, index, team)) {
        fall = index;
        break;
      }
    }
    no.push({ entry, note: fallLabel(field.rounds[fall], 'Cae'), fall });
  }
  yes.sort(byEntry);
  // Primero los que más lejos lo llevan.
  no.sort((a, b) => b.fall - a.fall || byEntry(a.entry, b.entry));
  return { yes, no: no.map(({ entry, note }) => ({ entry, note })) };
}

/** Situación real del equipo en una frase; null si el cuadro aún no ha empezado. */
export function teamSituation(field: KnockoutField, team: string): string | null {
  const last = field.rounds[field.rounds.length - 1];
  if (last?.final && last.winners.has(team) && !last.byes.has(team)) return 'Campeón';
  const out = field.eliminatedAt.get(team);
  if (out !== undefined && field.rounds[out]) return fallLabel(field.rounds[out], 'Cayó');
  return field.rounds.some((round) => round.winners.size > round.byes.size)
    ? 'Sigue en juego'
    : null;
}
