/** Lo más elegido en la liga: equipos por ronda, finales y pichichis. */
import { type BracketEntry, type StageId, percent, stageTeams } from './entries';

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

interface FinalPick {
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
export const normalizePlayer = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

interface ScorerPick {
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
