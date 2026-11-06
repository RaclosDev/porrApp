import { describe, expect, it } from 'vitest';
import { getDefaultBracketState } from '../../store/useAppStore';
import type { GroupStandings, TeamStanding } from '../../types/api';
import {
  buildBracketPrediction,
  fillKnownQualifiers,
  hasIncompleteR32,
  hasPlaceholderSlots,
  isEmptyBracket,
  officialGroupStatus,
} from '../../utils/bracketEditor';

const standing = (status: number): TeamStanding => ({
  pts: 0,
  diff: 0,
  gls: 0,
  mp: 3,
  fp: 0,
  pos: 0,
  status,
});

const allNames = (state: ReturnType<typeof getDefaultBracketState>) =>
  [...state.r32.left, ...state.r32.right].flatMap((m) => [m.home?.name, m.away?.name]);

describe('bracketEditor', () => {
  it('fills the slots of teams already through, using their real names', () => {
    const state = getDefaultBracketState();
    const official: GroupStandings = {
      E: { Alemania: standing(1) },
      C: { 'Bosnia y Her': standing(2) },
    };
    const odds = { C: [{ name: 'Bosnia y Her.' }] } as never;

    const filled = fillKnownQualifiers(state, official, odds);

    expect(filled).not.toBeNull();
    expect(allNames(filled!)).toContain('Alemania');
    expect(allNames(filled!)).toContain('Bosnia y Her.');
    expect(allNames(state)).toContain('1º Grupo E');
    expect(fillKnownQualifiers(state, {}, odds)).toBeNull();
  });

  it('knows an empty or incomplete bracket', () => {
    const state = getDefaultBracketState();
    expect(isEmptyBracket(state)).toBe(true);
    expect(hasPlaceholderSlots(state)).toBe(true);
    expect(hasIncompleteR32(state)).toBe(true);
  });

  it('builds the saved prediction from the bracket and the group draft', () => {
    const data = buildBracketPrediction({
      state: getDefaultBracketState(),
      userName: 'Ana',
      predictionName: 'La de Ana',
      topScorer: 'Mbappé',
      groups: { A: { first: 'México', second: 'Corea', third: 'Sudáfrica' } },
      thirds: ['Sudáfrica'],
      knockoutsOnly: false,
    });

    expect(data).toMatchObject({
      user: 'Ana',
      prediction: 'La de Ana',
      scorer: 'Mbappé',
      groups: { A: ['México', 'Corea', 'Sudáfrica'] },
      thirds: ['Sudáfrica'],
    });
    expect(data.r32).toHaveLength(16);
    expect(data.r32?.every(([home, away]) => home === null && away === null)).toBe(true);
  });

  it('reads the mathematical status of a team in its group', () => {
    const official: GroupStandings = { A: { 'Bosnia y Her': standing(2) } };
    const odds = { A: [{ name: 'Bosnia y Her.' }] } as never;
    expect(officialGroupStatus('Bosnia y Her.', official, odds)).toBe(2);
    expect(officialGroupStatus('España', official, odds)).toBe(0);
  });
});
