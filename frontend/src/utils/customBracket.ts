import type { Match } from '../types/api';

export type CustomPair = [string, string | null];

export interface CustomBracketMatchSlot {
  home: string | null;
  away: string | null;
  homePlaceholder: string;
  awayPlaceholder: string;
  isBye: boolean;
}

export interface CustomBracketDisplayRound {
  roundIndex: number;
  title: string;
  matches: CustomBracketMatchSlot[];
}

export function pairWinners(pairs: CustomPair[], picks: string[]): string[] | null {
  const winners: string[] = [];
  for (let index = 0; index < pairs.length; index++) {
    const [home, away] = pairs[index];
    const pick = picks[index] || (!away ? home : '');
    if (pick !== home && pick !== away) return null;
    winners.push(pick);
  }
  return winners;
}

export function getCustomRoundTitle(roundIndex: number, totalRounds: number): string {
  const distance = totalRounds - 1 - roundIndex;
  switch (distance) {
    case 0:
      return 'Final';
    case 1:
      return 'Semifinales';
    case 2:
      return 'Cuartos de final';
    case 3:
      return 'Octavos de final';
    case 4:
      return 'Dieciseisavos de final';
    default:
      return `Ronda ${roundIndex + 1}`;
  }
}

export function getTotalRounds(firstRoundCount: number): number {
  if (firstRoundCount <= 0) return 0;
  let count = firstRoundCount;
  let total = 0;
  while (count > 0) {
    total++;
    if (count === 1) break;
    count = Math.ceil(count / 2);
  }
  return total;
}

/**
 * Calcula todas las rondas de un cuadro eliminatorio desde los cruces de la primera ronda
 * hasta la final, rellenando con nombres reales o descripciones según las elecciones.
 */
export function computeCustomBracketRounds(
  firstRound: CustomPair[],
  picks: string[][],
): CustomBracketDisplayRound[] {
  if (!firstRound.length) return [];

  const totalRounds = getTotalRounds(firstRound.length);
  const result: CustomBracketDisplayRound[] = [];
  let currentPairs: (string | null)[][] = firstRound.map(([h, a]) => [h, a]);
  let previousCount = 0;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const title = getCustomRoundTitle(roundIndex, totalRounds);
    const roundPicks = picks[roundIndex] ?? [];
    const matches: CustomBracketMatchSlot[] = [];
    const resolvedWinners: (string | null)[] = [];

    for (let m = 0; m < currentPairs.length; m++) {
      const [h, a] = currentPairs[m];
      // Con un número impar de cruces, el último de la ronda siguiente no tiene rival.
      const isBye =
        a === null && (roundIndex === 0 ? firstRound[m]?.[1] === null : m * 2 + 1 >= previousCount);
      const homePlaceholder = h || (roundIndex === 0 ? 'Equipo' : `Ganador C${m * 2 + 1}`);
      const awayPlaceholder =
        a || (isBye ? 'Descanso' : roundIndex === 0 ? 'Equipo' : `Ganador C${m * 2 + 2}`);

      matches.push({
        home: h,
        away: a,
        homePlaceholder,
        awayPlaceholder,
        isBye,
      });

      // Ganador de este cruce
      if (isBye && h) {
        resolvedWinners.push(h);
      } else {
        const pick = roundPicks[m];
        if (pick && (pick === h || pick === a)) {
          resolvedWinners.push(pick);
        } else {
          resolvedWinners.push(null);
        }
      }
    }

    result.push({ roundIndex, title, matches });

    // Preparar parejas de la siguiente ronda
    if (roundIndex < totalRounds - 1) {
      const nextPairs: (string | null)[][] = [];
      for (let slot = 0; slot < resolvedWinners.length; slot += 2) {
        const homeWinner = resolvedWinners[slot] ?? null;
        const awayWinner =
          slot + 1 < resolvedWinners.length ? (resolvedWinners[slot + 1] ?? null) : null;
        nextPairs.push([homeWinner, awayWinner]);
      }
      previousCount = currentPairs.length;
      currentPairs = nextPairs;
    }
  }

  return result;
}

export interface CustomGroupRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * Clasificación de cada grupo con sus partidos terminados. Desempata como el backend al puntuar:
 * puntos, diferencia de goles, goles a favor y nombre.
 */
export function computeCustomGroupTables(
  teams: { name: string; groupName: string | null }[],
  matches: Match[],
): Record<string, CustomGroupRow[]> {
  const rows: Record<string, Record<string, CustomGroupRow>> = {};
  for (const team of teams) {
    if (!team.groupName) continue;
    (rows[team.groupName] ??= {})[team.name] = {
      team: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  }
  for (const match of matches) {
    if (match.round !== 'group' || !match.groupName || !match.finished) continue;
    if (match.homeScore == null || match.awayScore == null) continue;
    const home = rows[match.groupName]?.[match.home];
    const away = rows[match.groupName]?.[match.away];
    if (!home || !away) continue;
    const sides: [CustomGroupRow, number, number][] = [
      [home, match.homeScore, match.awayScore],
      [away, match.awayScore, match.homeScore],
    ];
    for (const [row, scored, conceded] of sides) {
      row.played++;
      row.goalsFor += scored;
      row.goalsAgainst += conceded;
      if (scored > conceded) {
        row.won++;
        row.points += 3;
      } else if (scored === conceded) {
        row.drawn++;
        row.points += 1;
      } else {
        row.lost++;
      }
    }
  }
  const result: Record<string, CustomGroupRow[]> = {};
  for (const group of Object.keys(rows).sort((a, b) => a.localeCompare(b, 'es'))) {
    result[group] = Object.values(rows[group]).sort(
      (left, right) =>
        right.points - left.points ||
        right.goalsFor - right.goalsAgainst - (left.goalsFor - left.goalsAgainst) ||
        right.goalsFor - left.goalsFor ||
        left.team.localeCompare(right.team),
    );
  }
  return result;
}

export interface CustomResultSlot {
  match: Match | null;
  home: string | null;
  away: string | null;
  homePlaceholder: string;
  awayPlaceholder: string;
  isBye: boolean;
}

export interface CustomResultRound {
  roundIndex: number;
  title: string;
  slots: CustomResultSlot[];
}

function roundNumber(match: Match): number | null {
  const found = /^bracket-(\d+)$/.exec(match.round ?? '');
  return found ? Number(found[1]) : null;
}

/** Ganador real de un cruce: el que marca el resultado o el que pasa por descanso. */
export function customMatchWinner(match: Match): string | null {
  if (!match.away_team_id) return match.home;
  return match.finished ? match.winner : null;
}

/**
 * Cuadro real de la competición: los cruces que ha creado el administrador en cada ronda y, en las
 * rondas que aún no ha creado, los huecos que dejan los ganadores de la anterior.
 */
export function computeCustomResultRounds(matches: Match[]): CustomResultRound[] {
  const byRound = new Map<number, Match[]>();
  for (const match of matches) {
    const round = roundNumber(match);
    if (round == null) continue;
    const list = byRound.get(round) ?? [];
    list.push(match);
    byRound.set(round, list);
  }
  const firstRound = byRound.get(1) ?? [];
  if (!firstRound.length) return [];

  const totalRounds = Math.max(getTotalRounds(firstRound.length), ...byRound.keys());
  const result: CustomResultRound[] = [];
  let previousWinners: (string | null)[] = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const created = [...(byRound.get(roundIndex + 1) ?? [])].sort((a, b) => a.id - b.id);
    let slots: CustomResultSlot[];
    if (created.length) {
      slots = created.map((match) => ({
        match,
        home: match.home,
        away: match.away_team_id ? match.away : null,
        homePlaceholder: match.home,
        awayPlaceholder: match.away_team_id ? match.away : 'Descanso',
        isBye: !match.away_team_id,
      }));
      previousWinners = created.map(customMatchWinner);
    } else {
      slots = [];
      for (let slot = 0; slot < Math.max(1, Math.ceil(previousWinners.length / 2)); slot++) {
        const home = previousWinners[slot * 2] ?? null;
        const away = previousWinners[slot * 2 + 1] ?? null;
        const isBye = slot * 2 + 1 >= previousWinners.length;
        slots.push({
          match: null,
          home,
          away,
          homePlaceholder: home ?? `Ganador C${slot * 2 + 1}`,
          awayPlaceholder: isBye ? 'Descanso' : (away ?? `Ganador C${slot * 2 + 2}`),
          isBye,
        });
      }
      previousWinners = slots.map(() => null);
    }
    result.push({ roundIndex, title: getCustomRoundTitle(roundIndex, totalRounds), slots });
  }
  return result;
}
