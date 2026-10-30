import { describe, expect, it } from 'vitest';
import type { MatchdayFixture, MatchdayPoints } from '../../types/api';
import {
  buildSubmission,
  filterFixtures,
  mergeDraftWithServer,
  parseDraft,
  resolveRound,
  roundLabelFor,
  roundsFromFixtures,
  roundsFromMatchdays,
  withScore,
  withSign,
  withoutSaved,
  type Draft,
} from '../../utils/matchday';

const fixture = (matchId: number, extra: Partial<MatchdayFixture> = {}): MatchdayFixture => ({
  matchId,
  homeTeam: `Local ${matchId}`,
  awayTeam: `Visitante ${matchId}`,
  homeTeamId: null,
  awayTeamId: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  matchDate: '2099-01-01T20:00:00',
  round: 'Jornada 1',
  groupName: null,
  finished: false,
  actualHomeScore: null,
  actualAwayScore: null,
  displayClock: null,
  predHomeScore: null,
  predAwayScore: null,
  predSign: null,
  locked: false,
  lockReason: null,
  pointsAwarded: null,
  isExactScore: null,
  isCorrectSign: null,
  scoringDetails: null,
  ...extra,
});

const pred = (homeScore: string, awayScore: string, sign = '') => ({ homeScore, awayScore, sign });

describe('roundLabelFor', () => {
  it('uses the group, then the round, then the calendar date', () => {
    expect(roundLabelFor(fixture(1, { groupName: 'A', round: 'group' }))).toBe('Grupo A');
    expect(roundLabelFor(fixture(1, { round: 'Jornada 3' }))).toBe('Jornada 3');
    expect(roundLabelFor(fixture(1, { round: 'group' }))).toBe('Fecha 2099-01-01');
    expect(roundLabelFor(fixture(1, { round: null, matchDate: null }))).toBe('Sin jornada');
  });
});

describe('round lists', () => {
  it('derives the rounds and the first unfinished one from the fixtures', () => {
    const list = roundsFromFixtures([
      fixture(1, { round: 'Jornada 1', finished: true }),
      fixture(2, { round: 'Jornada 2' }),
      fixture(3, { round: 'Jornada 2', finished: true }),
      fixture(4, { round: 'Jornada 3' }),
    ]);
    expect(list).toEqual({ rounds: ['Jornada 1', 'Jornada 2', 'Jornada 3'], current: 'Jornada 2' });
  });

  it('falls back to the last round when everything has finished', () => {
    const list = roundsFromFixtures([
      fixture(1, { round: 'Jornada 1', finished: true }),
      fixture(2, { round: 'Jornada 2', finished: true }),
    ]);
    expect(list.current).toBe('Jornada 2');
    expect(roundsFromFixtures([])).toEqual({ rounds: [], current: null });
  });

  it('reads the rounds and the current one from the league summary', () => {
    const day = (label: string, current: boolean) => ({ label, current }) as MatchdayPoints;
    expect(roundsFromMatchdays([day('J1', false), day('J2', true), day('J3', false)])).toEqual({
      rounds: ['J1', 'J2', 'J3'],
      current: 'J2',
    });
  });

  it('keeps a valid selection and otherwise shows the current round', () => {
    const list = { rounds: ['J1', 'J2'], current: 'J2' };
    expect(resolveRound('J1', list)).toBe('J1');
    expect(resolveRound('J9', list)).toBe('J2');
    expect(resolveRound(null, { rounds: ['J1'], current: null })).toBe('J1');
    expect(resolveRound(null, { rounds: [], current: null })).toBeNull();
  });
});

describe('parseDraft', () => {
  it('only accepts an object', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('[1]')).toBeNull();
    expect(parseDraft('{"5":{"homeScore":"1","awayScore":"0","sign":"1"}}')).toEqual({
      5: pred('1', '0', '1'),
    });
    expect(() => parseDraft('{roto')).toThrow();
  });
});

describe('mergeDraftWithServer', () => {
  it('prefers the draft on open matches and the server on locked ones', () => {
    const fixtures = [
      fixture(1, { predHomeScore: 0, predAwayScore: 0, predSign: 'X' }),
      fixture(2, { locked: true, predHomeScore: 3, predAwayScore: 1, predSign: '1' }),
      fixture(3),
    ];
    const draft: Draft = { 1: pred('2', '1', '1'), 2: pred('0', '4', '2') };
    const { predictions, draft: kept } = mergeDraftWithServer(fixtures, draft);
    expect(predictions).toEqual({
      1: pred('2', '1', '1'),
      2: pred('3', '1', '1'),
      3: pred('', ''),
    });
    expect(kept).toEqual({ 1: pred('2', '1', '1') });
  });

  it('keeps the draft of matches that did not arrive (other rounds)', () => {
    const draft: Draft = { 1: pred('1', '1', 'X'), 99: pred('2', '0', '1') };
    const { draft: kept } = mergeDraftWithServer([fixture(1)], draft);
    expect(kept).toEqual(draft);
  });

  it('fills missing fields of an old draft entry', () => {
    const draft = { 1: { sign: '2' } } as unknown as Draft;
    expect(mergeDraftWithServer([fixture(1)], draft).predictions[1]).toEqual(pred('', '', '2'));
  });

  it('does not mutate the stored draft', () => {
    const draft: Draft = { 1: pred('1', '0', '1') };
    mergeDraftWithServer([fixture(1, { locked: true })], draft);
    expect(draft).toEqual({ 1: pred('1', '0', '1') });
  });
});

describe('editing a prediction', () => {
  it('keeps two digits and derives the sign once both scores exist', () => {
    expect(withScore(pred('', ''), 'home', '1a23')).toEqual(pred('12', ''));
    expect(withScore(pred('2', ''), 'away', '2')).toEqual(pred('2', '2', 'X'));
    expect(withScore(pred('2', '2', 'X'), 'away', '')).toEqual(pred('2', '', ''));
  });

  it('adjusts the score so it agrees with the chosen sign', () => {
    expect(withSign(pred('', ''), '1')).toEqual(pred('2', '1', '1'));
    expect(withSign(pred('3', '0'), '1')).toEqual(pred('3', '0', '1'));
    expect(withSign(pred('3', '0'), 'X')).toEqual(pred('1', '1', 'X'));
    expect(withSign(pred('3', '0'), '2')).toEqual(pred('1', '2', '2'));
    expect(withSign(pred('0', '3'), '2')).toEqual(pred('0', '3', '2'));
  });
});

describe('buildSubmission', () => {
  const round = [fixture(1), fixture(2, { locked: true }), fixture(3)];

  it('sends the open matches of the round that have a prediction', () => {
    const draft: Draft = {
      1: pred('2', '1', '1'),
      2: pred('0', '0', 'X'),
      3: pred('', '', 'X'),
      99: pred('1', '0', '1'),
    };
    expect(buildSubmission(round, draft)).toEqual({
      kind: 'ready',
      items: [
        { matchId: 1, homeScore: 2, awayScore: 1, sign: '1' },
        { matchId: 3, homeScore: null, awayScore: null, sign: 'X' },
      ],
    });
  });

  it('rejects a half-filled score and reports an empty draft', () => {
    expect(buildSubmission(round, { 1: pred('1', '') })).toEqual({ kind: 'incomplete' });
    expect(buildSubmission(round, { 1: pred('', '') })).toEqual({ kind: 'empty' });
  });

  it('removes the saved matches from the draft', () => {
    expect(withoutSaved({ 1: pred('1', '0'), 3: pred('0', '0') }, [1])).toEqual({
      3: pred('0', '0'),
    });
  });
});

describe('filterFixtures', () => {
  const fixtures = [fixture(1), fixture(2, { finished: true, locked: true }), fixture(3)];
  const predictions: Draft = { 1: pred('1', '0', '1') };

  it('filters pending and finished matches', () => {
    expect(filterFixtures(fixtures, 'ALL', predictions, false)).toBe(fixtures);
    expect(filterFixtures(fixtures, 'PENDING', predictions, false).map((f) => f.matchId)).toEqual([
      3,
    ]);
    expect(filterFixtures(fixtures, 'PENDING', predictions, true)).toEqual([]);
    expect(filterFixtures(fixtures, 'FINISHED', predictions, false).map((f) => f.matchId)).toEqual([
      2,
    ]);
  });
});
