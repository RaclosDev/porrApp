import { describe, expect, it } from 'vitest';
import { nextRound } from '../../hooks/useLandingData';
import type { Match } from '../../types/api';

const match = (overrides: Partial<Match>): Match => ({
  id: 1,
  home: 'A',
  away: 'B',
  home_team_id: null,
  away_team_id: null,
  homeLogo: null,
  awayLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
  home_score: null,
  away_score: null,
  date: null,
  finished: false,
  round: 'Jornada 1',
  groupName: null,
  winner: null,
  displayClock: null,
  isStartingSoon: false,
  status: 'SCHEDULED',
  ...overrides,
});

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('nextRound', () => {
  it('returns the first three fixtures of the earliest round still to come', () => {
    const fixtures = [
      match({ id: 1, round: 'Jornada 3', date: inDays(9) }),
      match({ id: 2, round: 'Jornada 2', date: inDays(3) }),
      match({ id: 3, round: 'Jornada 2', date: inDays(2) }),
      match({ id: 4, round: 'Jornada 2', date: inDays(4) }),
      match({ id: 5, round: 'Jornada 2', date: inDays(5) }),
    ];
    expect(nextRound(fixtures).map((m) => m.id)).toEqual([3, 2, 4]);
  });

  it('skips finished, undated and already started matches', () => {
    const fixtures = [
      match({ id: 1, round: 'Jornada 1', date: inDays(-1), finished: true }),
      match({ id: 2, round: 'Jornada 1', date: inDays(-0.01) }),
      match({ id: 3, round: 'Jornada 1', date: null }),
      match({ id: 4, round: 'Jornada 2', date: inDays(1) }),
    ];
    expect(nextRound(fixtures).map((m) => m.id)).toEqual([4]);
  });

  it('returns nothing when the season is over', () => {
    expect(nextRound([match({ date: inDays(-3), finished: true })])).toEqual([]);
  });
});
