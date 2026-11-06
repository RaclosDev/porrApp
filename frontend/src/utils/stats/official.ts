/** Comparación con el cuadro oficial: qué se sabe ya de cada equipo y cuánto acertó la liga. */
import type { GroupStandings, PredictionData, TeamPair } from '../../types/api';
import {
  type BracketEntry,
  type StageId,
  KNOCKOUT_PATH,
  type PathStage,
  STAGE_SIZE,
  isRealTeam,
  flatTeams,
  unique,
  percent,
  stageTeams,
} from './entries';
import { type PickCount, normalizePlayer } from './rankings';

/** Lo que ya se sabe de un equipo en una ronda: llegó, no llegó o aún no se sabe. */
export type RealStatus = 'yes' | 'no' | 'pending';

export interface OfficialState {
  /** Hay algún resultado real (el torneo ha empezado). */
  started: boolean;
  /** El torneo ha terminado: hay campeón. */
  finished: boolean;
  status: (team: string, stage: StageId) => RealStatus;
  /** Ronda real más lejana del equipo y si ya está eliminado. */
  reach: (team: string) => { stage: PathStage | null; out: boolean };
  /** Equipos que ya se sabe que han llegado a la ronda. */
  teamsAt: (stage: PathStage) => string[];
  /** La ronda se conoce entera. */
  isComplete: (stage: StageId) => boolean;
  /** 1º del grupo, si el grupo ha terminado. */
  groupWinner: (group: string) => string | null;
  /** Máximos goleadores (varios si empatan); el valor es definitivo si `finished`. */
  scorers: string[];
}

/** Grupos del cuadro oficial: equipo -> grupo y posición. */
const officialPositions = (official: PredictionData | null | undefined) => {
  const positions = new Map<string, { group: string; pos: number }>();
  for (const [group, teams] of Object.entries(official?.groups ?? {})) {
    (teams ?? []).forEach((team, pos) => {
      if (isRealTeam(team)) positions.set(team, { group, pos });
    });
  }
  return positions;
};

/**
 * Estado real del torneo a partir del cuadro oficial y la clasificación de grupos.
 * Un equipo "no llega" a una ronda cuando la ronda está completa sin él, cuando cayó antes
 * o cuando su rival de la ronda anterior ya aparece en la siguiente.
 */
export function buildOfficialState(
  official: PredictionData | null | undefined,
  standings: GroupStandings | null | undefined,
): OfficialState {
  const real: Record<PathStage, string[]> = {
    groups: unique(flatTeams(official?.r32?.length ? official.r32 : official?.r1)),
    r16: unique(flatTeams(official?.r16)),
    qf: unique(flatTeams(official?.qf)),
    sf: unique(flatTeams(official?.sf)),
    final: unique((official?.final ?? []).filter(isRealTeam)),
    champion: isRealTeam(official?.champion) ? [official.champion] : [],
  };
  const pairsBefore: Partial<Record<PathStage, (TeamPair | string[])[]>> = {
    r16: official?.r32?.length ? official.r32 : (official?.r1 ?? []),
    qf: official?.r16 ?? [],
    sf: official?.qf ?? [],
    final: official?.sf ?? [],
    champion: official?.final ? [official.final] : [],
  };
  const positions = officialPositions(official);
  const thirds = new Set((official?.thirds ?? []).filter(isRealTeam));

  const groupFinished = (group: string) => {
    const teams = Object.values(standings?.[group] ?? {});
    return teams.length > 1 && teams.every((t) => (t.mp ?? 0) >= teams.length - 1);
  };
  const groupNames = Object.keys(official?.groups ?? {});
  const groupStageOver =
    real.groups.length >= STAGE_SIZE.groups ||
    (groupNames.length > 0 && groupNames.every(groupFinished));
  const isGroupDone = (group: string) => groupStageOver || groupFinished(group);

  const isComplete = (stage: StageId): boolean => {
    if (stage === 'first' || stage === 'second' || stage === 'third') return groupStageOver;
    return real[stage].length >= STAGE_SIZE[stage];
  };

  const groupStatus = (team: string, stage: 'groups' | 'first' | 'second' | 'third') => {
    if (stage === 'groups' && real.groups.includes(team)) return 'yes';
    if (stage === 'groups' && isComplete('groups')) return 'no';
    const at = positions.get(team);
    if (!at || !isGroupDone(at.group)) return 'pending';
    if (stage === 'first') return at.pos === 0 ? 'yes' : 'no';
    if (stage === 'second') return at.pos === 1 ? 'yes' : 'no';
    if (at.pos === 3) return 'no';
    if (at.pos < 2) return stage === 'groups' ? 'yes' : 'no';
    // 3º de un grupo terminado: depende de la tabla de terceros, que se cierra con el último grupo.
    if (!groupStageOver) return 'pending';
    return thirds.has(team) ? 'yes' : 'no';
  };

  /** Si ya está en esa ronda o en una posterior, la ha alcanzado. */
  const reachedFrom = (team: string, stage: PathStage) =>
    KNOCKOUT_PATH.slice(KNOCKOUT_PATH.indexOf(stage)).some((s) => real[s].includes(team));

  const status = (team: string, stage: StageId): RealStatus => {
    if (stage === 'first' || stage === 'second' || stage === 'third') {
      return groupStatus(team, stage);
    }
    if (reachedFrom(team, stage)) return 'yes';
    if (stage === 'groups') return groupStatus(team, stage);
    if (isComplete(stage)) return 'no';
    const previous = KNOCKOUT_PATH[KNOCKOUT_PATH.indexOf(stage) - 1];
    const before = status(team, previous);
    if (before === 'no') return 'no';
    if (before === 'yes') {
      const pair = (pairsBefore[stage] ?? []).find((p) => (p ?? []).includes(team));
      const rival = pair?.find((t) => isRealTeam(t) && t !== team);
      if (rival && real[stage].includes(rival)) return 'no';
    }
    return 'pending';
  };

  const reach = (team: string) => {
    let stage: PathStage | null = null;
    for (const s of KNOCKOUT_PATH) {
      const st = status(team, s);
      if (st !== 'yes') return { stage, out: st === 'no' };
      stage = s;
    }
    return { stage, out: false };
  };

  const started =
    real.groups.length > 0 ||
    Object.values(standings ?? {}).some((teams) =>
      Object.values(teams ?? {}).some((t) => (t.mp ?? 0) > 0),
    );

  return {
    started,
    finished: real.champion.length > 0,
    status,
    reach,
    teamsAt: (stage) => real[stage],
    isComplete,
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

/** Si el pichichi elegido coincide con alguno de los reales (sin tildes ni mayúsculas). */
export const isRealScorer = (name: string, realScorers: string[]) => {
  const key = normalizePlayer(name);
  return realScorers.some((s) => normalizePlayer(s) === key);
};

interface StageAccuracy {
  /** Aciertos medios por cuadro. */
  average: number;
  /** Equipos que tiene la ronda. */
  size: number;
}

/** Cuántos equipos de una ronda terminada acertó de media la liga. */
export function stageAccuracy(
  entries: BracketEntry[],
  stage: PathStage,
  official: OfficialState,
): StageAccuracy | null {
  if (entries.length === 0 || !official.isComplete(stage)) return null;
  const real = new Set(official.teamsAt(stage));
  const hits = entries.reduce(
    (sum, entry) => sum + stageTeams(entry.data, stage).filter((t) => real.has(t)).length,
    0,
  );
  return { average: hits / entries.length, size: real.size };
}

interface GroupWinnerPick {
  group: string;
  /** Primero más elegido del grupo. */
  top: PickCount | null;
  /** 1º real, si el grupo ha terminado. */
  real: string | null;
}

/** Ganador más elegido de cada grupo frente al real. */
export function groupWinnerPicks(
  entries: BracketEntry[],
  official: OfficialState,
): GroupWinnerPick[] {
  const byGroup = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    for (const [group, teams] of Object.entries(entry.data.groups ?? {})) {
      const winner = teams?.[0];
      if (!isRealTeam(winner)) continue;
      const counts = byGroup.get(group) ?? new Map<string, number>();
      counts.set(winner, (counts.get(winner) ?? 0) + 1);
      byGroup.set(group, counts);
    }
  }
  return [...byGroup.keys()]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((group) => {
      const [team, count] = [...byGroup.get(group)!].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'),
      )[0];
      return {
        group,
        top: { team, count, percent: percent(count, entries.length) },
        real: official.groupWinner(group),
      };
    });
}
