import { describe, it, expect } from 'vitest';
import { buildBracketData } from '../../utils/bracketBuilder';
import { game } from '../fixtures';

describe('bracketBuilder', () => {
  it('does not mistake finished group matches for the tournament final or 3rd place match', () => {
    const mockGames = [
      {
        home: 'México',
        away: 'Sudáfrica',
        home_score: 2,
        away_score: 0,
        finished: true,
        winner: 'México',
        round: 'final', // Malformed/polluted round from ESPN status
        groupName: 'A',
      },
      {
        home: 'Canadá',
        away: 'Bosnia y Her.',
        home_score: 1,
        away_score: 1,
        finished: true,
        winner: null,
        round: 'third', // Malformed/polluted round
        groupName: 'B',
      },
    ];

    const result = buildBracketData({}, {}, mockGames.map(game));

    // Final and 3rd place matches should not pick up group stage matches
    expect(result.final).toEqual([null, null]);
    expect(result.champion).toBeNull();
    expect(result.thirdPlaceMatch).toEqual([null, null]);
    expect(result.thirdPlaceWinner).toBeNull();
  });

  it('correctly detects genuine tournament knockout final and third place match', () => {
    const mockGames = [
      {
        home: 'España',
        away: 'Francia',
        home_score: 3,
        away_score: 1,
        finished: true,
        winner: 'España',
        round: 'final',
        groupName: null,
      },
      {
        home: 'Brasil',
        away: 'Argentina',
        home_score: 2,
        away_score: 1,
        finished: true,
        winner: 'Brasil',
        round: 'third',
        groupName: null,
      },
    ];

    const result = buildBracketData({}, {}, mockGames.map(game));

    expect(result.final).toEqual(['España', 'Francia']);
    expect(result.champion).toEqual({ name: 'España', isProvisional: false });
    expect(result.thirdPlaceMatch).toEqual(['Brasil', 'Argentina']);
    expect(result.thirdPlaceWinner).toEqual({ name: 'Brasil', isProvisional: false });
  });
});
