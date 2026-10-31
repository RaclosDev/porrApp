import { expect, it } from 'vitest';
import { defaultBracketState, getInitialBracketState } from '../../store/useAppStore';
import {
  reconstructBracketState,
  buildR32FromGroups,
  extractGroupsFromR32,
} from '../../utils/bracketDraft';
import { advanceBracketWinner } from '../../utils/bracketTransitions';
import { r32Source, bracketSides, EMPTY_OFFICIAL_BRACKET } from '../../utils/predictionViewer';
import { normalizePart } from '../../utils/predictionData';

const groups = Object.fromEntries(
  'ABCDEFGHIJKL'.split('').map((g) => [g, [`${g}1`, `${g}2`, `${g}3`]]),
);
const legacyNames = [
  'E1',
  'I1',
  'F1',
  'C1',
  'A2',
  'E2',
  'A1',
  'L1',
  'K2',
  'H1',
  'D1',
  'G1',
  'J1',
  'D2',
  'B1',
  'K1',
];
const canonicalNames = [
  'E1',
  'I1',
  'A2',
  'F1',
  'K2',
  'H1',
  'D1',
  'G1',
  'C1',
  'E2',
  'A1',
  'L1',
  'J1',
  'D2',
  'B1',
  'K1',
];

it('reconstructs absent-version historical groups in their original order', () => {
  const state = reconstructBracketState({ groups })!;
  expect(state.topologyVersion).toBe(1);
  expect([...state.r32.left, ...state.r32.right].map((m) => m.home?.name)).toEqual(legacyNames);
});

it('uses the FIFA branches for new drafts, reconstruction, extraction and viewer', () => {
  expect(defaultBracketState.topologyVersion).toBe(2);
  const data = { topologyVersion: 2 as const, groups };
  const state = reconstructBracketState(data)!;
  expect([...state.r32.left, ...state.r32.right].map((m) => m.home?.name)).toEqual(canonicalNames);
  expect(buildR32FromGroups(groups, [], 2)?.map((m) => m[0])).toEqual(canonicalNames);
  expect(extractGroupsFromR32(state.r32, {}, 2).groups.C.first).toBe('C1');
  const source = r32Source(data);
  expect(bracketSides(source, data).leftRounds[0].map((m) => m.home)).toEqual(
    canonicalNames.slice(0, 8),
  );
  expect(EMPTY_OFFICIAL_BRACKET.topologyVersion).toBe(2);
  expect(normalizePart(data, {})?.r32?.map((pair) => pair[0])).toEqual(canonicalNames);
});

it('does not invent finalists for a partial canonical prediction', () => {
  const part = normalizePart(
    {
      topologyVersion: 2,
      sf: [
        ['A', 'B'],
        ['C', 'D'],
      ],
      champion: 'A',
    },
    {},
  );
  expect(part?.final).toBeUndefined();
});

it('keeps explicit legacy and canonical local drafts unchanged on reload', () => {
  for (const topologyVersion of [1, 2] as const) {
    const state = reconstructBracketState({ groups, topologyVersion })!;
    localStorage.setItem('draft_bracket_u7_g42', JSON.stringify(state));
    expect(getInitialBracketState('42', '7')).toEqual(state);
  }
  const historical = reconstructBracketState({ groups })!;
  delete historical.topologyVersion;
  localStorage.setItem('draft_bracket_u7_g42', JSON.stringify(historical));
  expect(getInitialBracketState('42', '7')).toEqual(historical);
});

it('advances the canonical left and right branches independently to the final', () => {
  let state = reconstructBracketState({ groups, topologyVersion: 2 })!;
  for (const side of ['left', 'right'] as const) {
    for (const [roundIndex, round] of ['r32', 'r16', 'qf', 'sf'].entries()) {
      const matches = state[round as 'r32' | 'r16' | 'qf' | 'sf'][side];
      for (let i = 0; i < matches.length; i++)
        state = advanceBracketWinner(state, matches[i].home, side, roundIndex, i);
    }
  }
  expect(state.final?.home?.name).toBe('E1');
  expect(state.final?.away?.name).toBe('C1');
  expect(state.thirdPlaceMatch?.home?.name).toBe('K2');
  expect(state.thirdPlaceMatch?.away?.name).toBe('J1');
});
