import { describe, expect, it } from 'vitest';
import type {
  GroupStandings,
  Match,
  ParticipantScore,
  PredictionData,
  ScoreLogEntry,
} from '../../types/api';
import type { ViewerPrediction } from '../../utils/predictionData';
import {
  bracketSides,
  isTeamEliminated,
  isTeamImpossibleForRound,
  r32Source,
  sameTeam,
  selectViewerPoints,
  thirdPlacedTeams,
  type ViewerPoints,
} from '../../utils/predictionViewer';
import {
  centerPointsTotal,
  featuredSlot,
  groupTeamData,
  groupTeamPoints,
  roundFooterTotal,
  slotDetails,
  type SlotContext,
} from '../../utils/viewerScoring';

const game = (extra: Partial<Match>): Match =>
  ({
    round: 'r16',
    finished: true,
    home_score: null,
    away_score: null,
    winner: null,
    ...extra,
  }) as Match;

const pointsWith = (log: ScoreLogEntry[], extra: Partial<ViewerPoints> = {}): ViewerPoints => ({
  total: 0,
  r1: 0,
  r32: 0,
  r16: 0,
  qf: 0,
  sf: 0,
  finals: 0,
  scorer: 0,
  log,
  exactMatches: {},
  passedTeams: {},
  ...extra,
});

describe('selectViewerPoints', () => {
  const row = { id: 5, name: 'Ana', total: 9, log: [] } as unknown as ParticipantScore;

  it('prefers the detailed score, then the leaderboard row by id or name', () => {
    const detailed = { id: 5, total: 12, log: [] } as unknown as ParticipantScore;
    expect(selectViewerPoints(detailed, [row], 5, 'Ana')).toBe(detailed);
    expect(selectViewerPoints(null, [row], '5', undefined)).toBe(row);
    expect(selectViewerPoints(null, [row], null, 'ana')).toBe(row);
  });

  it('never substitutes a namesake for a requested prediction id', () => {
    const other = { ...row, id: 6, total: 20 };
    expect(selectViewerPoints(null, [row, other], 6, 'Ana')).toBe(other);
    expect(selectViewerPoints(null, [row], 99, 'Ana').total).toBe(0);
    expect(selectViewerPoints(null, [row, other], null, 'Ana').total).toBe(0);
  });

  it('falls back to zero points without a user', () => {
    const empty = selectViewerPoints(null, [], 5, 'Nadie');
    expect(empty.total).toBe(0);
  });
});

describe('bracket rounds', () => {
  it('splits the round of 32 and later rounds into two halves', () => {
    const r32 = Array.from({ length: 16 }, (_, i) => [`L${i}`, `V${i}`]);
    const part = { r32, r16: [['A', 'B']], qf: [], sf: [] } as unknown as ViewerPrediction;
    const { leftRounds, rightRounds } = bracketSides(r32Source(part), part);
    expect(leftRounds[0]).toHaveLength(8);
    expect(leftRounds[0][0]).toEqual({ home: 'L0', away: 'V0' });
    expect(rightRounds[0][0]).toEqual({ home: 'L8', away: 'V8' });
    expect(leftRounds[1]).toEqual([{ home: 'A', away: 'B' }]);
    expect(rightRounds[1]).toEqual([]);
  });

  it('has empty rounds without a prediction', () => {
    const { leftRounds } = bracketSides(r32Source(null), null);
    expect(leftRounds.every((r) => r.length === 0)).toBe(true);
  });
});

describe('team status', () => {
  it('treats EEUU and Estados Unidos as the same team', () => {
    expect(sameTeam('EEUU', 'Estados Unidos')).toBe(true);
    expect(sameTeam('España', 'Francia')).toBe(false);
  });

  it('detects teams knocked out in the group or in a knockout match', () => {
    const standings = { A: { España: { status: 4 } } } as unknown as GroupStandings;
    expect(isTeamEliminated('España', standings, [])).toBe(true);
    const games = [game({ home: 'Francia', away: 'Brasil', winner: 'Brasil' })];
    expect(isTeamEliminated('Francia', {}, games)).toBe(true);
    expect(isTeamEliminated('Brasil', {}, games)).toBe(false);
    expect(isTeamEliminated('1º Grupo A', standings, games)).toBe(false);
  });

  it('knows who can no longer reach the final or the third place match', () => {
    const official = { final: ['Brasil'], thirdPlaceMatch: ['Francia'] } as PredictionData;
    expect(isTeamImpossibleForRound('Brasil', 'thirdPlaceMatch', official, [])).toBe(true);
    expect(isTeamImpossibleForRound('Francia', 'champion', official, [])).toBe(true);
    const semi = [game({ round: 'sf', home: 'Italia', away: 'Japón', winner: 'Japón' })];
    expect(isTeamImpossibleForRound('Italia', 'final', {}, semi)).toBe(true);
    expect(isTeamImpossibleForRound('Japón', 'thirdPlaceMatch', {}, semi)).toBe(true);
    expect(isTeamImpossibleForRound('Japón', 'final', {}, semi)).toBe(false);
    expect(isTeamImpossibleForRound('Italia', 0, {}, semi)).toBe(false);
  });
});

describe('slotDetails', () => {
  const part = { r16: [['España', 'Brasil']], champion: 'España' } as unknown as ViewerPrediction;
  const ctx = (extra: Partial<SlotContext> = {}): SlotContext => ({
    part,
    points: pointsWith([]),
    officialBracket: {},
    officialPoints: {},
    allGames: [],
    ...extra,
  });

  it('uses the points log when it covers the slot', () => {
    const points = pointsWith([{ stage: 'r32', amount: 4, msg: 'España pasa a octavos' }]);
    expect(slotDetails('España', 0, ctx({ points }))).toEqual({ isWinner: true, slotPoints: '+4' });
  });

  it('marks a lost slot with 0 once the official round is complete', () => {
    const officialBracket = {
      r16: Array.from({ length: 8 }, (_, i) => [`A${i}`, `B${i}`]),
    } as PredictionData;
    expect(slotDetails('Brasil', 0, ctx({ officialBracket }))).toEqual({
      isWinner: true,
      slotPoints: '0',
    });
  });

  it('shows nothing while the result is still open', () => {
    expect(slotDetails('Brasil', 0, ctx())).toEqual({ isWinner: true, slotPoints: null });
    expect(slotDetails('Italia', 0, ctx())).toEqual({ isWinner: false, slotPoints: null });
    expect(slotDetails('España', 0, ctx({ officialBracket: null }))).toEqual({
      isWinner: true,
      slotPoints: null,
    });
  });

  it('picks the champion or runner-up entry for the final', () => {
    const points = pointsWith([
      { stage: 'finals', amount: 10, msg: 'Campeón: España' },
      { stage: 'finals', amount: 6, msg: 'Subcampeón: Brasil' },
    ]);
    const withFinal = { ...part, final: ['España', 'Brasil'] } as ViewerPrediction;
    expect(slotDetails('Brasil', 'final', ctx({ part: withFinal, points })).slotPoints).toBe('+6');
    expect(slotDetails('España', 'champion', ctx({ points })).slotPoints).toBe('+10');
  });
});

describe('round and center totals', () => {
  it('adds the points of the teams the prediction sends through', () => {
    const part = { r16: [['España', 'Brasil']] } as unknown as ViewerPrediction;
    const points = pointsWith([
      { stage: 'r32', amount: 3, msg: 'España' },
      { stage: 'r32', amount: 3, msg: 'Italia' },
    ]);
    const round = [
      { home: 'España', away: 'Italia' },
      { home: '???', away: null },
    ];
    expect(roundFooterTotal(round, 0, part, points)).toBe(3);
    expect(roundFooterTotal([], 0, part, points)).toBe(0);
  });

  it('uses the finals total or adds the finals log', () => {
    expect(centerPointsTotal(pointsWith([], { finals: 7 }))).toBe(7);
    const log = [
      { stage: 'finals', amount: 2, msg: 'a' },
      { stage: 'finals', amount: 3, msg: 'b' },
      { stage: 'sf', amount: 9, msg: 'c' },
    ];
    expect(centerPointsTotal(pointsWith(log))).toBe(5);
  });
});

describe('group tables', () => {
  const standings = {
    A: { España: { mp: 3, status: 5 }, Italia: { mp: 3, status: 0 }, Japón: { mp: 0 } },
  } as unknown as GroupStandings;
  const odds = { A: [{ name: 'España' }, { name: 'Italia' }] } as never;

  it('colours exact, qualified and wrong picks', () => {
    const exact = pointsWith([], { exactMatches: { A: { 1: true } } } as Partial<ViewerPoints>);
    expect(groupTeamData('A', 'España', 1, exact, standings, odds)).toEqual({
      color: 'var(--hit)',
      mp: 3,
      status: 5,
    });
    const passed = pointsWith([], { passedTeams: { Italia: true } } as Partial<ViewerPoints>);
    expect(groupTeamData('A', 'Italia', 2, passed, standings, odds).color).toBe('var(--pass)');
    expect(groupTeamData('A', 'Italia', 2, pointsWith([]), standings, odds).color).toBe(
      'var(--miss)',
    );
    expect(groupTeamData('A', 'Japón', 3, pointsWith([]), standings, odds).color).toBe('inherit');
    expect(groupTeamData('B', 'Japón', 3, pointsWith([]), standings, odds).mp).toBe(0);
  });

  it('adds the group-stage points of a team', () => {
    const points = pointsWith([
      { stage: 'r1', amount: 2, msg: 'Grupo A: España primera' },
      { stage: 'r1', amount: 1, msg: 'Grupo B: España' },
      { stage: 'r32', amount: 5, msg: 'Grupo A: España' },
    ]);
    expect(groupTeamPoints(points, 'A', 'España')).toBe(2);
    expect(groupTeamPoints(points, 'a', 'España')).toBe(2);
  });

  it('lists the third-placed team of each group in order', () => {
    const part = {
      groups: { B: ['x', 'y', 'Japón'], A: { first: 'a', second: 'b', third: 'Italia' }, C: ['q'] },
    } as unknown as ViewerPrediction;
    expect(thirdPlacedTeams(part)).toEqual([
      { group: 'A', team: 'Italia' },
      { group: 'B', team: 'Japón' },
    ]);
    expect(thirdPlacedTeams(null)).toEqual([]);
  });
});

describe('featuredSlot', () => {
  const next = { round: 'final', groupName: null, home: 'España', away: 'Brasil' } as Match;

  it('highlights the teams of the next knockout match, live once it starts', () => {
    const now = new Date('2026-07-19T20:00:00Z');
    expect(featuredSlot({ ...next, date: '2026-07-20T19:00:00Z' }, 'España', 'final', now)).toEqual(
      { isFeatured: true, isLive: false },
    );
    expect(featuredSlot({ ...next, date: '2026-07-19T19:00:00Z' }, 'Brasil', 'final', now)).toEqual(
      { isFeatured: true, isLive: true },
    );
    expect(featuredSlot(next, 'Italia', 'final', now).isFeatured).toBe(false);
    expect(featuredSlot(next, 'España', 0, now).isFeatured).toBe(false);
    expect(featuredSlot(null, 'España', 'final', now).isFeatured).toBe(false);
  });
});
