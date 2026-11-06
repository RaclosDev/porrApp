import { describe, expect, it } from 'vitest';
import type { Match } from '../../types/api';
import {
  bracketResults,
  completeCustomPrediction,
  firstRoundPairs,
  teamsByGroup,
} from '../../utils/customBracketPrediction';

const match = (fields: Partial<Match>): Match =>
  ({
    id: 1,
    home: '',
    away: '',
    home_team_id: 1,
    away_team_id: 2,
    finished: false,
    round: 'group',
    ...fields,
  }) as Match;

describe('customBracketPrediction', () => {
  it('groups teams alphabetically by group and orders custom first-round matches by id', () => {
    expect(
      teamsByGroup([
        { name: 'Rojos', groupName: 'B' },
        { name: 'Azules', groupName: 'A' },
        { name: 'Verdes', groupName: null },
      ]),
    ).toEqual({ A: ['Azules'], B: ['Rojos'] });

    const later = match({ id: 9, round: 'bracket-1', home: 'C', away: 'D' });
    const bye = match({ id: 3, round: 'bracket-1', home: 'A', away: '', away_team_id: null });
    expect(firstRoundPairs([later, bye], false)).toEqual([
      ['A', null],
      ['C', 'D'],
    ]);
  });

  it('reads winners, eliminations and decided rounds from the real bracket', () => {
    const results = bracketResults([
      match({
        round: 'bracket-1',
        home: 'A',
        away: 'B',
        winner: 'A',
        finished: true,
      }),
      match({ round: 'bracket-1', home: 'C', away: '', away_team_id: null }),
      match({ round: 'bracket-2', home: 'A', away: 'C', finished: false }),
    ]);

    expect([...results.realWinners[0]]).toEqual(['A']);
    expect(results.eliminatedAt.get('B')).toBe(0);
    expect(results.decidedRounds).toEqual([true, false]);
  });

  it('builds the prediction only when every match and group is chosen', () => {
    const input = {
      firstRound: [
        ['A', 'B'],
        ['C', 'D'],
      ] as [string, string | null][],
      picks: [['A', 'D'], ['D']],
      groups: { X: ['A', 'B'] },
      teamsByGroup: { X: ['A', 'B'] },
      isFullBracket: true,
      userName: 'Ana',
      predictionName: '',
    };

    expect(completeCustomPrediction(input)).toMatchObject({
      prediction: 'Ana',
      champion: 'D',
      customRounds: [['A', 'D'], ['D']],
      groups: { X: ['A', 'B'] },
    });
    expect(completeCustomPrediction({ ...input, picks: [['A', 'D']] })).toBeNull();
    expect(completeCustomPrediction({ ...input, groups: { X: ['A'] } })).toBeNull();
  });
});
