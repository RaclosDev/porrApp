import { describe, expect, it } from 'vitest';
import { formatWinShare, nflOverall, nflRecord } from '../../utils/nflStandings';
import type { LeagueStanding } from '../../types/api';

const row = (teamName: string, wins: number, losses: number, ties = 0): LeagueStanding => ({
  rank: 1,
  teamName,
  teamLogo: null,
  points: wins,
  gamesPlayed: wins + losses + ties,
  wins,
  losses,
  ties,
  goalDiff: 0,
  goalsFor: 0,
  goalsAgainst: 0,
});

describe('nflStandings', () => {
  it('writes the record and win share like the NFL', () => {
    expect(nflRecord(row('Giants', 4, 2, 1))).toBe('4-2-1');
    expect(nflRecord(row('Bills', 6, 1))).toBe('6-1');
    expect(formatWinShare(row('Giants', 4, 2, 1))).toBe('.643');
    expect(formatWinShare(row('Unbeaten', 3, 0))).toBe('1.000');
    expect(formatWinShare(row('New', 0, 0))).toBe('.000');
  });

  it('ranks all 32 teams by win share, a tie counting half', () => {
    const table = nflOverall([row('Patriots', 5, 3), row('Giants', 4, 2, 1), row('Bills', 6, 1)]);
    expect(table.map((team) => team.teamName)).toEqual(['Bills', 'Giants', 'Patriots']);
    expect(table.map((team) => team.rank)).toEqual([1, 2, 3]);
  });
});
