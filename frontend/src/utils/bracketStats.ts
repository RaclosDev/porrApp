/**
 * Agregados de los cuadros de una liga (Más elegidos y Buscador) y su comparación con el
 * cuadro oficial. Todo es puro: recibe los pronósticos visibles y el cuadro oficial
 * (`/api/standings/official-bracket`, que tiene la misma forma que un pronóstico).
 *
 * Cómo se lee un cuadro:
 * - `groups[g]` = [1º, 2º, 3º]; los 3º que pasan están en `thirds`.
 * - `r32` son los cruces de dieciseisavos (vacío en los cuadros antiguos, que se deducen
 *   de los grupos); `r16`, `qf` y `sf` son los equipos que llegan a octavos, cuartos y semis.
 * - `final` son los dos finalistas y `champion`, el campeón.
 */
import type { GroupStandings, PredictionData, PredictionSummary, TeamPair } from '../types/api';

/** Cuadro de un participante con lo que necesitan las estadísticas. */
export interface BracketEntry {
  /** Clave del pronóstico, para abrirlo en el visor. */
  id: string;
  name: string;
  userId: number | null;
  data: PredictionData;
}

/** Rondas del camino al título y posiciones de grupo. */
export type StageId =
  'groups' | 'first' | 'second' | 'third' | 'r16' | 'qf' | 'sf' | 'final' | 'champion';

/** Rondas en orden: para llegar a una hay que haber pasado la anterior. */
export const KNOCKOUT_PATH = ['groups', 'r16', 'qf', 'sf', 'final', 'champion'] as const;
export type PathStage = (typeof KNOCKOUT_PATH)[number];

/** Posiciones de grupo que se pueden buscar (solo en ligas de cuadro completo). */
export const GROUP_POSITIONS = ['first', 'second', 'third'] as const;

export const STAGE_LABEL: Record<StageId, string> = {
  groups: 'Pasa de grupos',
  first: '1º de grupo',
  second: '2º de grupo',
  third: 'Pasa como 3º',
  r16: 'Llega a octavos',
  qf: 'Llega a cuartos',
  sf: 'Llega a semis',
  final: 'Llega a la final',
  champion: 'Campeón',
};

/** Nombre corto para selectores de ronda. */
export const STAGE_SHORT: Record<StageId, string> = {
  groups: 'Pasan grupos',
  first: '1º',
  second: '2º',
  third: '3º',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semis',
  final: 'Final',
  champion: 'Campeón',
};

/** Equipos que tiene cada ronda en el Mundial de 48 (los mismos huecos que el editor de cuadro). */
const STAGE_SIZE: Record<PathStage, number> = {
  groups: 32,
  r16: 16,
  qf: 8,
  sf: 4,
  final: 2,
  champion: 1,
};

/** Equipo real: ni vacío ni un hueco del tipo "1º Grupo A" o "Por definir". */
const isRealTeam = (team: unknown): team is string => {
  if (typeof team !== 'string') return false;
  const t = team.trim();
  if (!t || t.includes('º')) return false;
  const lower = t.toLowerCase();
  return lower !== 'por definir' && lower !== 'tbd' && t !== '???';
};

const flatTeams = (pairs: (TeamPair | string)[] | null | undefined): string[] =>
  (pairs ?? []).flat().filter(isRealTeam);

const unique = (teams: string[]) => [...new Set(teams)];

export const percent = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;

/** Pronósticos con cuadro visible, en el orden en que llegan. */
export function toBracketEntries(predictions: PredictionSummary[]): BracketEntry[] {
  return predictions
    .filter((p): p is PredictionSummary & { data: PredictionData } => p.data != null)
    .filter((p) => {
      const d = p.data;
      return isRealTeam(d.champion) || flatTeams(d.r16).length > 0 || flatTeams(d.sf).length > 0;
    })
    .map((p) => ({
      id: p.key,
      name: p.participantName || p.data.user || 'Anónimo',
      userId: p.userId,
      data: p.data,
    }));
}

const groupLists = (data: PredictionData): string[][] =>
  Object.values(data.groups ?? {}).filter((g): g is string[] => Array.isArray(g));

/** Equipos que el cuadro pone en una ronda o posición. */
export function stageTeams(data: PredictionData, stage: StageId): string[] {
  const thirds = new Set((data.thirds ?? []).filter(isRealTeam));
  switch (stage) {
    case 'groups': {
      const r32 = flatTeams(data.r32?.length ? data.r32 : data.r1);
      if (r32.length >= STAGE_SIZE.groups) return unique(r32);
      return unique(
        groupLists(data)
          .flatMap((g) => [g[0], g[1], thirds.has(g[2]) ? g[2] : null])
          .filter(isRealTeam),
      );
    }
    case 'first':
      return unique(groupLists(data).map((g) => g[0])).filter(isRealTeam);
    case 'second':
      return unique(groupLists(data).map((g) => g[1])).filter(isRealTeam);
    case 'third':
      return unique(groupLists(data).map((g) => g[2])).filter(
        (t) => isRealTeam(t) && thirds.has(t),
      );
    case 'r16':
      return unique(flatTeams(data.r16));
    case 'qf':
      return unique(flatTeams(data.qf));
    case 'sf':
      return unique(flatTeams(data.sf));
    case 'final':
      return unique((data.final ?? []).filter(isRealTeam));
    case 'champion':
      return isRealTeam(data.champion) ? [data.champion] : [];
  }
}

/** La ronda más lejana a la que el cuadro lleva al equipo (null: no pasa de grupos). */
export function predictedReach(data: PredictionData, team: string): PathStage | null {
  let reach: PathStage | null = null;
  for (const stage of KNOCKOUT_PATH) {
    if (stageTeams(data, stage).includes(team)) reach = stage;
  }
  return reach;
}

/** Texto de hasta dónde llega un equipo, en un pronóstico ("Cae en…") o en la realidad. */
export function reachLabel(reach: PathStage | null, tense: 'predicted' | 'real'): string {
  const out = tense === 'predicted' ? 'Cae en' : 'Cayó en';
  switch (reach) {
    case 'champion':
      return 'Campeón';
    case 'final':
      return 'Subcampeón';
    case 'sf':
      return `${out} semis`;
    case 'qf':
      return `${out} cuartos`;
    case 'r16':
      return `${out} octavos`;
    case 'groups':
      return `${out} dieciseisavos`;
    default:
      return tense === 'predicted' ? 'No pasa de grupos' : 'Fuera en grupos';
  }
}

export interface PickCount {
  team: string;
  count: number;
  percent: number;
}

/** Equipos más elegidos para una ronda, de más a menos votos. */
export function rankPicks(entries: BracketEntry[], stage: StageId): PickCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const team of stageTeams(entry.data, stage)) {
      counts.set(team, (counts.get(team) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([team, count]) => ({ team, count, percent: percent(count, entries.length) }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team, 'es'));
}

export interface FinalPick {
  teams: [string, string];
  count: number;
  percent: number;
}

/** Finales más repetidas (sin importar el orden de los dos equipos). */
export function rankFinals(entries: BracketEntry[]): FinalPick[] {
  const counts = new Map<string, { teams: [string, string]; count: number }>();
  for (const entry of entries) {
    const finalists = stageTeams(entry.data, 'final');
    if (finalists.length !== 2) continue;
    const teams = [...finalists].sort((a, b) => a.localeCompare(b, 'es')) as [string, string];
    const key = teams.join('|');
    const current = counts.get(key);
    if (current) current.count++;
    else counts.set(key, { teams, count: 1 });
  }
  return [...counts.values()]
    .map((f) => ({ ...f, percent: percent(f.count, entries.length) }))
    .sort((a, b) => b.count - a.count || a.teams[0].localeCompare(b.teams[0], 'es'));
}

/** Nombre de jugador comparable: sin tildes, en minúsculas y con espacios simples. */
const normalizePlayer = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface ScorerPick {
  /** La forma de escribirlo que más se repite. */
  name: string;
  count: number;
  percent: number;
}

/** Pichichis más elegidos; agrupa los que solo se diferencian en tildes o mayúsculas. */
export function rankScorers(entries: BracketEntry[]): ScorerPick[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const entry of entries) {
    const raw = entry.data.scorer?.trim();
    if (!raw) continue;
    const key = normalizePlayer(raw);
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count++;
    group.spellings.set(raw, (group.spellings.get(raw) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({
      name: [...g.spellings].sort((a, b) => b[1] - a[1])[0][0],
      count: g.count,
      percent: percent(g.count, entries.length),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
}

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

export interface StageAccuracy {
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

export interface GroupWinnerPick {
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

export interface TeamStageRow {
  stage: StageId;
  count: number;
  percent: number;
  status: RealStatus;
}

/** Cuántos cuadros ponen al equipo en cada ronda (el "embudo" del buscador). */
export function teamFunnel(
  entries: BracketEntry[],
  team: string,
  stages: readonly StageId[],
  official: OfficialState,
): TeamStageRow[] {
  return stages.map((stage) => {
    const count = entries.filter((e) => stageTeams(e.data, stage).includes(team)).length;
    return {
      stage,
      count,
      percent: percent(count, entries.length),
      status: official.status(team, stage),
    };
  });
}

/** Puesto de grupo que el cuadro da al equipo (los cuadros guardan 1º, 2º y 3º). */
function groupPositionLabel(data: PredictionData, team: string): string {
  const thirds = new Set(data.thirds ?? []);
  for (const g of groupLists(data)) {
    const pos = g.indexOf(team);
    if (pos === 0) return 'Lo pone 1º';
    if (pos === 1) return 'Lo pone 2º';
    if (pos === 2) return thirds.has(team) ? 'Lo pone 3º y pasa' : 'Lo pone 3º, no pasa';
  }
  return 'Lo pone 4º';
}

const isGroupPosition = (stage: StageId) =>
  stage === 'first' || stage === 'second' || stage === 'third';

export interface StagePickers {
  /** Los que ponen al equipo en esa ronda. */
  yes: BracketEntry[];
  /** El resto, con hasta dónde lo llevan (o su puesto de grupo). */
  no: { entry: BracketEntry; note: string }[];
}

/** Quién pone al equipo en la ronda y hasta dónde lo lleva el resto. */
export function stagePickers(entries: BracketEntry[], team: string, stage: StageId): StagePickers {
  const byName = (a: BracketEntry, b: BracketEntry) => a.name.localeCompare(b.name, 'es');
  const yes: BracketEntry[] = [];
  const no: (StagePickers['no'][number] & { depth: number })[] = [];
  for (const entry of entries) {
    if (stageTeams(entry.data, stage).includes(team)) {
      yes.push(entry);
    } else if (isGroupPosition(stage)) {
      no.push({ entry, note: groupPositionLabel(entry.data, team), depth: 0 });
    } else {
      const reach = predictedReach(entry.data, team);
      no.push({
        entry,
        note: reachLabel(reach, 'predicted'),
        depth: reach ? KNOCKOUT_PATH.indexOf(reach) : -1,
      });
    }
  }
  yes.sort(byName);
  // Primero los que más cerca se quedan.
  no.sort((a, b) => b.depth - a.depth || byName(a.entry, b.entry));
  return { yes, no: no.map(({ entry, note }) => ({ entry, note })) };
}

/**
 * Equipos que se pueden buscar, por grupo oficial. Con `onlyPicked` se quedan los que aparecen
 * en algún cuadro (en las ligas de solo eliminatorias, los 32 de dieciseisavos).
 */
export function searchableTeams(
  entries: BracketEntry[],
  official: PredictionData | null | undefined,
  onlyPicked = false,
): { group: string | null; teams: string[] }[] {
  const picked = new Set(
    entries.flatMap((e) => KNOCKOUT_PATH.flatMap((s) => stageTeams(e.data, s))),
  );
  const groups = Object.entries(official?.groups ?? {})
    .map(([group, teams]) => ({
      group,
      teams: (teams ?? [])
        .filter((t) => isRealTeam(t) && (!onlyPicked || picked.has(t)))
        .sort((a, b) => a.localeCompare(b, 'es')),
    }))
    .filter((g) => g.teams.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group, 'es'));
  if (groups.length > 0) return groups;
  return [{ group: null, teams: [...picked].sort((a, b) => a.localeCompare(b, 'es')) }];
}
