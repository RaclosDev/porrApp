/**
 * Torneo con fase de grupos (hoy, el Mundial) leído como un cuadro más, para que Más elegidos y el
 * Buscador usen las mismas piezas que el resto de eliminatorias (`knockoutStats`). Todo es puro.
 *
 * La predicción no guarda quién gana cada cruce, sino quién llega a cada ronda:
 * - `groups[g]` = [1º, 2º, 3º]; los 3º que pasan están en `thirds`.
 * - `r32` son los cruces de dieciseisavos (vacío en las predicciones antiguas, que se deducen de
 *   los grupos); `r16`, `qf` y `sf`, los equipos que llegan a octavos, cuartos y semifinales.
 * - `final` son los dos finalistas y `champion`, el campeón.
 *
 * Llegar a una ronda es pasar la anterior: quien está en `r16` pasa de dieciseisavos. La fase de
 * grupos es la primera ronda, la que pasan 32. El cuadro oficial
 * (`/api/world-cup/official-bracket`) tiene la misma forma que una predicción.
 */
import type { GroupStandings, PredictionData, PredictionSummary, TeamPair } from '../types/api';
import { knockoutRoundTitle } from './knockoutDraw';
import type { FieldRound, KnockoutEntry, KnockoutField } from './knockoutStats';
import type { RealStatus } from './pickStats';

/** Lo que guarda la predicción, en orden: quién pasa de grupos y quién pasa cada ronda. */
const STAGES = [
  { key: 'groups', title: 'Grupos', size: 32 },
  { key: 'r16', title: knockoutRoundTitle('r32'), size: 16 },
  { key: 'qf', title: knockoutRoundTitle('r16'), size: 8 },
  { key: 'sf', title: knockoutRoundTitle('qf'), size: 4 },
  { key: 'final', title: knockoutRoundTitle('sf'), size: 2 },
  { key: 'champion', title: knockoutRoundTitle('final'), size: 1 },
] as const;
type Stage = (typeof STAGES)[number];

/** En las ligas de solo eliminatorias no se elige la fase de grupos. */
const stagesOf = (knockoutsOnly: boolean): readonly Stage[] =>
  knockoutsOnly ? STAGES.slice(1) : STAGES;

/** Puestos de grupo que se pueden buscar: no son rondas del cuadro. */
export const GROUP_POSITIONS = ['first', 'second', 'third'] as const;
export type GroupPosition = (typeof GROUP_POSITIONS)[number];

/** Equipo real: ni vacío ni un hueco del tipo "1º Grupo A" o "Por definir". */
export const isRealTeam = (team: unknown): team is string => {
  if (typeof team !== 'string') return false;
  const t = team.trim();
  if (!t || t.includes('º')) return false;
  const lower = t.toLowerCase();
  return lower !== 'por definir' && lower !== 'tbd' && t !== '???';
};

const flatTeams = (pairs: (TeamPair | string)[] | null | undefined): string[] =>
  (pairs ?? []).flat().filter(isRealTeam);

const unique = (teams: string[]) => [...new Set(teams)];

export const groupLists = (data: PredictionData): string[][] =>
  Object.values(data.groups ?? {}).filter((g): g is string[] => Array.isArray(g));

/**
 * Equipos que el cuadro hace pasar la fase. Con `deduce`, si no trae los dieciseisavos, los que
 * pasan de grupos salen de los grupos y los terceros elegidos (así son las predicciones antiguas).
 */
function passing(data: PredictionData, stage: Stage['key'], deduce: boolean): string[] {
  if (stage === 'champion') return isRealTeam(data.champion) ? [data.champion] : [];
  if (stage === 'final') return unique((data.final ?? []).filter(isRealTeam));
  if (stage !== 'groups') return unique(flatTeams(data[stage]));
  const drawn = unique(flatTeams(data.r32?.length ? data.r32 : data.r1));
  if (!deduce || drawn.length >= STAGES[0].size) return drawn;
  const thirds = new Set(data.thirds ?? []);
  return unique(
    groupLists(data)
      .flatMap((g) => [g[0], g[1], thirds.has(g[2]) ? g[2] : null])
      .filter(isRealTeam),
  );
}

/** Predicción de un torneo con fase de grupos: como cuadro genérico y con lo que guardó. */
export interface GroupStageEntry extends KnockoutEntry {
  data: PredictionData;
}

/** Predicciones con cuadro visible, en el orden en que llegan. */
export function toGroupStageEntries(
  predictions: PredictionSummary[],
  knockoutsOnly: boolean,
): GroupStageEntry[] {
  const stages = stagesOf(knockoutsOnly);
  return predictions.flatMap((prediction) => {
    const data = prediction.data;
    if (!data) return [];
    const filled =
      isRealTeam(data.champion) || flatTeams(data.r16).length > 0 || flatTeams(data.sf).length > 0;
    if (!filled) return [];
    return [
      {
        id: prediction.key,
        name: prediction.participantName || data.user || 'Anónimo',
        userId: prediction.userId,
        data,
        picks: stages.map((stage) => passing(data, stage.key, true)),
      },
    ];
  });
}

/**
 * Ronda del buscador a la que apuntan los enlaces compartidos antes de unificarlo, que nombraban
 * la ronda a la que se llega (`stage=r16`) o el puesto de grupo (`stage=first`).
 */
export function roundOfStage(stage: string, knockoutsOnly: boolean): string | null {
  const round = stagesOf(knockoutsOnly).findIndex((item) => item.key === stage);
  if (round >= 0) return String(round);
  return !knockoutsOnly && GROUP_POSITIONS.some((position) => position === stage) ? stage : null;
}

/** El torneo real: el cuadro y lo que solo tiene la fase de grupos. */
export interface GroupStageTournament {
  /** Cuadro real; la fase de grupos es su primera ronda salvo en las ligas de solo eliminatorias. */
  field: KnockoutField;
  /** Hay algún resultado real. */
  started: boolean;
  /** Hay campeón. */
  finished: boolean;
  /** Si el equipo acabó en ese puesto de su grupo (el 3º, solo si además pasó). */
  positionStatus: (team: string, position: GroupPosition) => RealStatus;
  /** 1º del grupo, si el grupo ha terminado. */
  groupWinner: (group: string) => string | null;
  /** Máximos goleadores (varios si empatan); definitivo cuando el torneo ha terminado. */
  scorers: string[];
}

/**
 * Estado real del torneo a partir del cuadro oficial y la clasificación de grupos. Un equipo queda
 * fuera en una ronda cuando la ronda está completa sin él o cuando su rival ya la ha pasado.
 */
export function groupStageTournament(
  official: PredictionData | null | undefined,
  standings: GroupStandings | null | undefined,
  knockoutsOnly: boolean,
): GroupStageTournament {
  const real = Object.fromEntries(
    STAGES.map((stage) => [stage.key, official ? passing(official, stage.key, false) : []]),
  ) as Record<Stage['key'], string[]>;
  const pairs: Record<Stage['key'], (TeamPair | string[])[]> = {
    groups: [],
    r16: official?.r32?.length ? official.r32 : (official?.r1 ?? []),
    qf: official?.r16 ?? [],
    sf: official?.qf ?? [],
    final: official?.sf ?? [],
    champion: official?.final ? [official.final] : [],
  };

  const positions = new Map<string, { group: string; pos: number }>();
  for (const [group, teams] of Object.entries(official?.groups ?? {})) {
    (teams ?? []).forEach((team, pos) => {
      if (isRealTeam(team)) positions.set(team, { group, pos });
    });
  }
  const thirds = new Set(official?.thirds ?? []);
  const groupFinished = (group: string) => {
    const teams = Object.values(standings?.[group] ?? {});
    return teams.length > 1 && teams.every((t) => (t.mp ?? 0) >= teams.length - 1);
  };
  const groupNames = Object.keys(official?.groups ?? {});
  const groupStageOver =
    real.groups.length >= STAGES[0].size ||
    (groupNames.length > 0 && groupNames.every(groupFinished));
  const isGroupDone = (group: string) => groupStageOver || groupFinished(group);
  /** Puesto del equipo en su grupo, si el grupo ha terminado. */
  const finalPosition = (team: string) => {
    const at = positions.get(team);
    return at && isGroupDone(at.group) ? at.pos : null;
  };

  const positionStatus = (team: string, position: GroupPosition): RealStatus => {
    const pos = finalPosition(team);
    if (pos === null) return 'pending';
    if (position !== 'third') return pos === GROUP_POSITIONS.indexOf(position) ? 'yes' : 'no';
    if (pos !== 2) return 'no';
    // 3º de un grupo terminado: depende de la tabla de terceros, que se cierra con el último grupo.
    if (!groupStageOver) return 'pending';
    return thirds.has(team) ? 'yes' : 'no';
  };
  const passedGroups = (team: string): RealStatus => {
    if (real.groups.length >= STAGES[0].size) return 'no';
    const pos = finalPosition(team);
    if (pos === null) return 'pending';
    if (pos < 2) return 'yes';
    return pos === 2 ? positionStatus(team, 'third') : 'no';
  };

  const stages = stagesOf(knockoutsOnly);
  const eliminatedAt = new Map<string, number>();
  const rounds = stages.map((stage, index): FieldRound => {
    const at = STAGES.indexOf(stage);
    // Quien ya está en una ronda posterior también ha pasado esta.
    const winners = new Set(STAGES.slice(at).flatMap((later) => real[later.key]));
    const decided = real[stage.key].length >= stage.size;
    const teams = at === 0 ? [...positions.keys()] : real[STAGES[at - 1].key];
    if (at === 0) {
      for (const team of teams) if (passedGroups(team) === 'yes') winners.add(team);
    }
    for (const team of teams) {
      if (winners.has(team) || eliminatedAt.has(team)) continue;
      const rival = pairs[stage.key]
        .find((pair) => (pair ?? []).includes(team))
        ?.find((other) => isRealTeam(other) && other !== team);
      const lost = at === 0 ? passedGroups(team) === 'no' : Boolean(rival && winners.has(rival));
      if (decided || lost) eliminatedAt.set(team, index);
    }
    return {
      title: stage.title,
      final: stage.key === 'champion',
      teams: new Set(teams),
      winners,
      byes: new Set(),
      decided,
    };
  });

  return {
    field: {
      rounds,
      eliminatedAt,
      // La predicción no ordena los equipos por cruce: cualquiera puede estar en cualquier hueco.
      slots: (_team, round) =>
        Array.from({ length: stages[round]?.size ?? 0 }, (_, position) => position),
    },
    started:
      real.groups.length > 0 ||
      Object.values(standings ?? {}).some((teams) =>
        Object.values(teams ?? {}).some((t) => (t.mp ?? 0) > 0),
      ),
    finished: real.champion.length > 0,
    positionStatus,
    groupWinner: (group) => {
      const winner = official?.groups?.[group]?.[0];
      return isGroupDone(group) && isRealTeam(winner) ? winner : null;
    },
    scorers: (official?.scorer ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
