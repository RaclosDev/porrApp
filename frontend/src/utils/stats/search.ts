/** Buscador: el camino de un equipo en los cuadros de la liga y quién lo elige. */
import type { PredictionData } from '../../types/api';
import {
  type BracketEntry,
  type StageId,
  KNOCKOUT_PATH,
  isRealTeam,
  percent,
  groupLists,
  stageTeams,
  predictedReach,
  reachLabel,
} from './entries';
import { type RealStatus, type OfficialState } from './official';

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
