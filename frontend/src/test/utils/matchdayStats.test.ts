import { describe, expect, it } from 'vitest';
import type { MatchStats } from '../../types/api';
import { groupByRound, latestRound, realSign, signShares } from '../../utils/matchdayStats';

const match = (fields: Partial<MatchStats>): MatchStats => ({
  matchId: 1,
  round: 'Jornada 1',
  matchDate: '2026-10-01T20:00:00',
  homeTeam: 'Real Madrid',
  awayTeam: 'Barcelona',
  homeTeamLogo: null,
  awayTeamLogo: null,
  finished: false,
  live: false,
  homeScore: null,
  awayScore: null,
  predictions: 0,
  homeWins: 0,
  draws: 0,
  awayWins: 0,
  topScores: [],
  exactHits: null,
  signHits: null,
  ...fields,
});

describe('matchdayStats', () => {
  it('agrupa por jornada y abre la del último partido empezado', () => {
    const rounds = groupByRound([
      match({ matchId: 1, round: 'Jornada 1', matchDate: '2026-10-01T20:00:00' }),
      match({ matchId: 2, round: 'Jornada 2', matchDate: '2026-10-08T20:00:00' }),
      match({ matchId: 3, round: 'Jornada 1', matchDate: '2026-10-02T20:00:00' }),
    ]);
    expect(rounds.map((r) => [r.label, r.matches.map((m) => m.matchId)])).toEqual([
      ['Jornada 1', [1, 3]],
      ['Jornada 2', [2]],
    ]);
    expect(latestRound(rounds)).toBe('Jornada 2');
    expect(latestRound([])).toBeNull();
  });

  it('reparte el 1X2 sobre los pronósticos con signo', () => {
    const shares = signShares(match({ homeWins: 2, draws: 1, awayWins: 1 }));
    expect(shares.map((s) => [s.sign, s.percent])).toEqual([
      ['1', 50],
      ['X', 25],
      ['2', 25],
    ]);
    expect(signShares(match({})).every((s) => s.percent === 0)).toBe(true);
  });

  it('solo da el signo real cuando el partido ha terminado', () => {
    expect(realSign(match({ finished: true, homeScore: 1, awayScore: 1 }))).toBe('X');
    expect(realSign(match({ finished: false, live: true, homeScore: 2, awayScore: 0 }))).toBeNull();
  });
});
