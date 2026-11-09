import type { BracketState } from '../store/useAppStore';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const team = (value: unknown): boolean =>
  value === null || (record(value) && typeof value.name === 'string');

const match = (value: unknown): boolean =>
  record(value) && typeof value.id === 'string' && team(value.home) && team(value.away);

/** Cruces por lado de la ronda, o -1 si no es una ronda bien formada. */
const sideSize = (value: unknown): number => {
  if (!record(value)) return -1;
  const { left, right } = value;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return -1;
  return left.every(match) && right.every(match) ? left.length : -1;
};

/**
 * Cada ronda está completa (8, 4, 2 y 1 cruces por lado) o, si el torneo empieza más tarde, vacía:
 * las vacías van siempre antes de la primera que se juega, y las semifinales existen siempre.
 */
const rounds = (value: Record<string, unknown>): boolean => {
  let started = false;
  return [8, 4, 2, 1].every((full, index) => {
    const size = sideSize(value[['r32', 'r16', 'qf', 'sf'][index]]);
    if (size === full) {
      started = true;
      return true;
    }
    return size === 0 && !started && full > 1;
  });
};

/** Accepts incomplete selections, but never incomplete structures read from local storage. */
export function isBracketState(value: unknown): value is BracketState {
  return (
    record(value) &&
    (value.topologyVersion == null || value.topologyVersion === 1 || value.topologyVersion === 2) &&
    rounds(value) &&
    (value.final === null || match(value.final)) &&
    (value.thirdPlaceMatch === null || match(value.thirdPlaceMatch)) &&
    team(value.champion) &&
    team(value.thirdPlaceWinner)
  );
}
