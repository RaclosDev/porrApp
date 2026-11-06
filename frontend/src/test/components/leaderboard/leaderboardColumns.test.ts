import { describe, expect, it } from 'vitest';
import {
  compactMatchdayLabel,
  isOwnRow,
  leaderboardColumns,
  rankLabel,
} from '../../../components/leaderboard/leaderboardColumns';

const keys = (options: Parameters<typeof leaderboardColumns>[0]) =>
  leaderboardColumns(options).map((col) => col.key);

const base = {
  isMatchday: false,
  ownBracket: false,
  pichichi: false,
  ownBracketHasGroupPoints: false,
  selectedMatchday: null,
};

describe('leaderboardColumns', () => {
  it('shows every World Cup phase, plus the scorer when the league counts it', () => {
    expect(keys(base)).toEqual(['total', 'matchPoints', 'r1', 'r32', 'r16', 'qf', 'sf', 'finals']);
    expect(keys({ ...base, pichichi: true }).slice(-1)).toEqual(['scorer']);
  });

  it('shows groups in an own bracket only when someone scored there', () => {
    expect(keys({ ...base, ownBracket: true })).toEqual(['total', 'r32']);
    expect(keys({ ...base, ownBracket: true, ownBracketHasGroupPoints: true })).toEqual([
      'total',
      'r1',
      'r32',
    ]);
  });

  it('shows the selected matchday with a short label in matchday leagues', () => {
    const [, matchday] = leaderboardColumns({
      ...base,
      isMatchday: true,
      selectedMatchday: 'Jornada 12',
    });
    expect(matchday).toMatchObject({ key: 'matchday', shortLabel: 'J12', kind: 'matchday' });
    expect(keys({ ...base, isMatchday: true })).toEqual(['total', 'matchPoints']);
  });
});

describe('leaderboard helpers', () => {
  it('labels the podium, the last paid row and the rest', () => {
    expect(rankLabel(1, 9, 30)).toBe('🥇');
    expect(rankLabel(3, 9, 30)).toBe('🥉');
    expect(rankLabel(2, 9, 0)).toBe(2);
    expect(rankLabel(9, 9, 4)).toBe('🐢');
    expect(rankLabel(5, 9, 10)).toBe(5);
  });

  it('shortens matchday labels', () => {
    expect(compactMatchdayLabel('Fecha 2026-03-14')).toBe('14/03');
    expect(compactMatchdayLabel('Octavos')).toBe('Octavos');
    expect(compactMatchdayLabel(null)).toBe('');
  });

  it('recognises the own row by id and, without ids, by name', () => {
    expect(isOwnRow({ userId: 7, name: 'Ana' }, '7', 'Bea')).toBe(true);
    expect(isOwnRow({ userId: 8, name: 'Ana' }, '7', 'Ana')).toBe(false);
    expect(isOwnRow({ name: 'Ana' }, null, 'Ana')).toBe(true);
  });
});
