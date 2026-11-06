/** Cuadros de la liga: rondas, equipos de cada ronda y hasta dónde llega un equipo. */
import type { PredictionData, PredictionSummary, TeamPair } from '../../types/api';

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
export const STAGE_SIZE: Record<PathStage, number> = {
  groups: 32,
  r16: 16,
  qf: 8,
  sf: 4,
  final: 2,
  champion: 1,
};

/** Equipo real: ni vacío ni un hueco del tipo "1º Grupo A" o "Por definir". */
export const isRealTeam = (team: unknown): team is string => {
  if (typeof team !== 'string') return false;
  const t = team.trim();
  if (!t || t.includes('º')) return false;
  const lower = t.toLowerCase();
  return lower !== 'por definir' && lower !== 'tbd' && t !== '???';
};

export const flatTeams = (pairs: (TeamPair | string)[] | null | undefined): string[] =>
  (pairs ?? []).flat().filter(isRealTeam);

export const unique = (teams: string[]) => [...new Set(teams)];

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

export const groupLists = (data: PredictionData): string[][] =>
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
