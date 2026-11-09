/**
 * Lo que solo tiene un torneo con fase de grupos y no es una ronda del cuadro: en qué puesto de su
 * grupo pone cada predicción a un equipo y quién es el primero más elegido de cada grupo.
 */
import type { PredictionData } from '../types/api';
import {
  GROUP_POSITIONS,
  groupLists,
  isRealTeam,
  type GroupPosition,
  type GroupStageEntry,
  type GroupStageTournament,
} from './groupStageBracket';
import { percent, type RealStatus } from './pickStats';

const POSITION_LABEL: Record<GroupPosition, string> = {
  first: '1º de grupo',
  second: '2º de grupo',
  third: 'Pasa como 3º',
};

const byName = (a: string, b: string) => a.localeCompare(b, 'es');

/** Si la predicción pone al equipo en ese puesto (el 3º, solo si además lo hace pasar). */
function hasPosition(data: PredictionData, team: string, position: GroupPosition): boolean {
  const index = GROUP_POSITIONS.indexOf(position);
  if (position === 'third' && !(data.thirds ?? []).includes(team)) return false;
  return groupLists(data).some((group) => group[index] === team);
}

/** Puesto de grupo que la predicción da al equipo (se guardan 1º, 2º y 3º). */
function positionNote(data: PredictionData, team: string): string {
  for (const group of groupLists(data)) {
    const pos = group.indexOf(team);
    if (pos === 0) return 'Lo pone 1º';
    if (pos === 1) return 'Lo pone 2º';
    if (pos === 2) {
      return (data.thirds ?? []).includes(team) ? 'Lo pone 3º y pasa' : 'Lo pone 3º, no pasa';
    }
  }
  return 'Lo pone 4º';
}

export interface PositionRow {
  id: GroupPosition;
  label: string;
  count: number;
  percent: number;
  status: RealStatus;
}

/** Cuántas predicciones ponen al equipo en cada puesto de su grupo. */
export function positionRows(
  entries: GroupStageEntry[],
  team: string,
  tournament: GroupStageTournament,
): PositionRow[] {
  return GROUP_POSITIONS.map((position) => {
    const count = entries.filter((entry) => hasPosition(entry.data, team, position)).length;
    return {
      id: position,
      label: POSITION_LABEL[position],
      count,
      percent: percent(count, entries.length),
      status: tournament.positionStatus(team, position),
    };
  });
}

/** Quién pone al equipo en ese puesto y en cuál lo pone el resto. */
export function positionPickers(
  entries: GroupStageEntry[],
  team: string,
  position: GroupPosition,
): { yes: GroupStageEntry[]; no: { entry: GroupStageEntry; note: string }[] } {
  const sorted = [...entries].sort((a, b) => byName(a.name, b.name));
  return {
    yes: sorted.filter((entry) => hasPosition(entry.data, team, position)),
    no: sorted
      .filter((entry) => !hasPosition(entry.data, team, position))
      .map((entry) => ({ entry, note: positionNote(entry.data, team) })),
  };
}

interface GroupWinnerPick {
  group: string;
  /** Primero más elegido del grupo. */
  team: string;
  count: number;
  percent: number;
  /** 1º real, si el grupo ha terminado. */
  real: string | null;
}

/** Primero más elegido de cada grupo frente al real. */
export function groupWinnerPicks(
  entries: GroupStageEntry[],
  tournament: GroupStageTournament,
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
  return [...byGroup.keys()].sort(byName).map((group) => {
    const [team, count] = [...byGroup.get(group)!].sort(
      (a, b) => b[1] - a[1] || byName(a[0], b[0]),
    )[0];
    return {
      group,
      team,
      count,
      percent: percent(count, entries.length),
      real: tournament.groupWinner(group),
    };
  });
}

/**
 * Equipos del buscador, por grupo oficial. Con `only` se quedan esos (en las ligas de solo
 * eliminatorias, los que juegan el cuadro); sin grupos oficiales, van todos juntos.
 */
export function teamsByGroup(
  official: PredictionData | null | undefined,
  known: string[],
  only: boolean,
): { label: string | null; teams: string[] }[] {
  const allowed = new Set(known);
  const groups = Object.entries(official?.groups ?? {})
    .map(([group, teams]) => ({
      label: `Grupo ${group}`,
      teams: (teams ?? []).filter((t) => isRealTeam(t) && (!only || allowed.has(t))).sort(byName),
    }))
    .filter((group) => group.teams.length > 0)
    .sort((a, b) => byName(a.label, b.label));
  return groups.length > 0 ? groups : [{ label: null, teams: [...allowed].sort(byName) }];
}
