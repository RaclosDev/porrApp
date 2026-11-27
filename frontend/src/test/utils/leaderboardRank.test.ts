import { describe, expect, it } from 'vitest';
import type { ParticipantScore } from '../../types/api';
import { rankByTotal, rankedCount } from '../../utils/leaderboardRank';

const row = (id: number, total: number, pending = false) =>
  ({ id, userId: id, name: 'Ana', total, pending }) as ParticipantScore;

describe('rankByTotal', () => {
  it('shares the place on ties and skips nobody, like the full leaderboard', () => {
    const rows = [row(1, 30), row(2, 30), row(3, 20), row(4, 10)];
    const ranks = rankByTotal(rows);
    expect(rows.map((r) => ranks.get(r))).toEqual([1, 1, 2, 3]);
  });

  it('leaves out whoever has the fee pending, even with more points', () => {
    const rows = [row(1, 50, true), row(2, 30), row(3, 20)];
    const ranks = rankByTotal(rows);
    expect(rows.map((r) => ranks.get(r))).toEqual([null, 1, 2]);
    expect(rankedCount(rows)).toBe(2);
  });
});
