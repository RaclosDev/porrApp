/** Pichichi más elegido de la liga, en las competiciones en las que se predice. */
import type { PredictionData, ScorerCandidate } from '../types/api';
import { percent } from './pickStats';

/** Nombre de jugador comparable: sin tildes, en minúsculas y con espacios simples. */
const normalizePlayer = (name: string) =>
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
export function rankScorers(entries: { data: PredictionData }[]): ScorerPick[] {
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

/** Si el pichichi elegido coincide con alguno de los reales (sin tildes ni mayúsculas). */
export const isRealScorer = (name: string, realScorers: string[]) => {
  const key = normalizePlayer(name);
  return realScorers.some((s) => normalizePlayer(s) === key);
};

/** El jugador de la lista que se llama exactamente así (sin mirar tildes ni mayúsculas), si es uno solo. */
export function findPlayer(players: ScorerCandidate[], name: string): ScorerCandidate | null {
  const wanted = normalizePlayer(name);
  if (!wanted) return null;
  const found = players.filter((player) => normalizePlayer(player.name) === wanted);
  return found.length === 1 ? found[0] : null;
}

/**
 * Jugadores que proponer mientras se escribe: los que llevan todas las palabras escritas en el
 * nombre, antes los que empiezan por ellas y, a igualdad, los que más goles llevan. Sin nada
 * escrito, los máximos goleadores.
 */
export function suggestPlayers(
  players: ScorerCandidate[],
  text: string,
  limit = 8,
): ScorerCandidate[] {
  const words = normalizePlayer(text).split(' ').filter(Boolean);
  const ranked = players.flatMap((player) => {
    const name = normalizePlayer(player.name);
    if (!words.every((word) => name.includes(word))) return [];
    const nameWords = name.split(' ');
    const starts = words.every((word) => nameWords.some((part) => part.startsWith(word)));
    return [{ player, rank: starts ? 0 : 1 }];
  });
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.player.goals - a.player.goals ||
        a.player.name.localeCompare(b.player.name, 'es'),
    )
    .slice(0, limit)
    .map((entry) => entry.player);
}
