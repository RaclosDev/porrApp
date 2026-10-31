import type { BracketState } from '../store/useAppStore';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const team = (value: unknown): boolean =>
  value === null || (record(value) && typeof value.name === 'string');

const match = (value: unknown): boolean =>
  record(value) && typeof value.id === 'string' && team(value.home) && team(value.away);

const side = (value: unknown, length: number): boolean =>
  record(value) &&
  ['left', 'right'].every((key) => {
    const matches = value[key];
    return Array.isArray(matches) && matches.length === length && matches.every(match);
  });

/** Accepts incomplete selections, but never incomplete structures read from local storage. */
export function isBracketState(value: unknown): value is BracketState {
  return (
    record(value) &&
    side(value.r32, 8) &&
    side(value.r16, 4) &&
    side(value.qf, 2) &&
    side(value.sf, 1) &&
    (value.final === null || match(value.final)) &&
    (value.thirdPlaceMatch === null || match(value.thirdPlaceMatch)) &&
    team(value.champion) &&
    team(value.thirdPlaceWinner)
  );
}
