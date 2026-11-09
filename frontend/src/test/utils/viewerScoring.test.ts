import { describe, expect, it } from 'vitest';
import type { GroupOdds, GroupStandings, PredictionData, ScoreLogEntry } from '../../types/api';
import type { ViewerPrediction } from '../../utils/predictionData';
import type { ViewerPoints } from '../../utils/predictionViewer';
import {
  centerPointsTotal,
  featuredSlot,
  groupTeamData,
  groupTeamPoints,
  roundFooterTotal,
  slotDetails,
  type SlotContext,
} from '../../utils/viewerScoring';
import { game, standing } from '../fixtures';

const pointsWith = (
  log: ScoreLogEntry[] | null,
  extra: Partial<ViewerPoints> = {},
): ViewerPoints => ({
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

/** Pronóstico completo: España gana a Brasil la final; Italia gana el tercer puesto a Japón. */
const part: ViewerPrediction = {
  r16: [
    ['España', 'Portugal'],
    ['Brasil', 'Italia'],
  ],
  qf: [
    ['España', 'Italia'],
    ['Brasil', 'Japón'],
  ],
  sf: [
    ['España', 'Italia'],
    ['Brasil', 'Japón'],
  ],
  final: ['España', 'Brasil'],
  champion: 'España',
  thirdPlaceMatch: ['Italia', 'Japón'],
  thirdPlaceWinner: 'Italia',
};

const ctx = (extra: Partial<SlotContext> = {}): SlotContext => ({
  part,
  points: pointsWith([]),
  officialBracket: {},
  officialPoints: {},
  allGames: [],
  ...extra,
});

/** Semifinal jugada: gana el local. */
const semifinal = (home: string, away: string) =>
  game({ round: 'sf', finished: true, home, away, home_score: 2, away_score: 1 });

describe('slotDetails: who advances in the prediction', () => {
  const winner = (name: string | null, round: Parameters<typeof slotDetails>[1]) =>
    slotDetails(name, round, ctx({ officialBracket: null })).isWinner;

  it('reads each round from the next one of the prediction', () => {
    expect(winner('Portugal', 0)).toBe(true);
    expect(winner('Japón', 1)).toBe(true);
    expect(winner('Portugal', 1)).toBe(false);
    expect(winner('Italia', 2)).toBe(true);
    expect(winner('Brasil', 3)).toBe(true);
    expect(winner('Italia', 3)).toBe(false);
  });

  it('marks the champion in the final and the winner of the third place match', () => {
    expect(winner('España', 4)).toBe(true);
    expect(winner('España', 'final')).toBe(true);
    expect(winner('Brasil', 'final')).toBe(false);
    expect(winner('España', 'champion')).toBe(true);
    expect(winner('Italia', 5)).toBe(true);
    expect(winner('Italia', 'thirdPlaceMatch')).toBe(true);
    expect(winner('Japón', 'thirdPlaceMatch')).toBe(false);
  });

  it('never marks an empty slot, an unknown team or a round that does not exist', () => {
    expect(slotDetails(null, 0, ctx())).toEqual({ isWinner: false, slotPoints: null });
    expect(slotDetails('???', 'final', ctx())).toEqual({ isWinner: false, slotPoints: null });
    expect(winner('España', 9)).toBe(false);
    expect(slotDetails('España', 0, ctx({ part: null })).isWinner).toBe(false);
  });
});

describe('slotDetails: points from the score log', () => {
  it('shows 0 for an entry that scored nothing', () => {
    const points = pointsWith([{ stage: 'r16', amount: 0, msg: 'Japón no pasa a cuartos' }]);
    expect(slotDetails('Japón', 1, ctx({ points })).slotPoints).toBe('0');
  });

  it('finds the entry of EEUU under either of its names', () => {
    const usa = { ...part, qf: [['EEUU', 'Italia']] } as ViewerPrediction;
    const points = pointsWith([{ stage: 'r16', amount: 30, msg: 'Estados Unidos pasa a cuartos' }]);
    expect(slotDetails('EEUU', 1, ctx({ part: usa, points })).slotPoints).toBe('+30');
  });

  it('only uses the entry of its own stage', () => {
    const points = pointsWith([{ stage: 'r32', amount: 25, msg: 'Italia pasa a octavos' }]);
    expect(slotDetails('Italia', 2, ctx({ points })).slotPoints).toBeNull();
  });

  it('tells third from fourth place in the third place match', () => {
    const points = pointsWith([
      { stage: 'finals', amount: 100, msg: 'Tercer puesto: Italia' },
      { stage: 'finals', amount: 75, msg: 'Cuarto puesto: Japón' },
      { stage: 'finals', amount: 1, msg: 'Cuarto puesto: Italia' },
    ]);
    expect(slotDetails('Italia', 'thirdPlaceMatch', ctx({ points })).slotPoints).toBe('+100');
    expect(slotDetails('Japón', 'thirdPlaceMatch', ctx({ points })).slotPoints).toBe('+75');
  });

  it('tells the champion from the runner-up in the final', () => {
    const points = pointsWith([
      { stage: 'finals', amount: 150, msg: 'Subcampeón: Brasil' },
      { stage: 'finals', amount: 200, msg: 'Campeón: España' },
    ]);
    expect(slotDetails('España', 'final', ctx({ points })).slotPoints).toBe('+200');
    expect(slotDetails('Brasil', 'final', ctx({ points })).slotPoints).toBe('+150');
  });
});

describe('slotDetails: slots the score log does not cover', () => {
  const fullRound = (size: number) =>
    Array.from({ length: size }, (_, i) => [`L${i}`, `V${i}`]) as PredictionData['qf'];

  it('gives 0 once the official next round is full without the team', () => {
    expect(slotDetails('Japón', 1, ctx({ officialBracket: { qf: fullRound(4) } })).slotPoints).toBe(
      '0',
    );
    expect(
      slotDetails('Italia', 2, ctx({ officialBracket: { sf: fullRound(2) } })).slotPoints,
    ).toBe('0');
    expect(
      slotDetails('Brasil', 3, ctx({ officialBracket: { final: ['Francia', 'Italia'] } }))
        .slotPoints,
    ).toBe('0');
  });

  it('stays open while the official next round still has free slots', () => {
    const qf = [...fullRound(3)!, ['Francia', '1º Grupo A']] as PredictionData['qf'];
    expect(slotDetails('Japón', 1, ctx({ officialBracket: { qf } })).slotPoints).toBeNull();
  });

  it('stays open when the team is in the official next round, whatever its spelling', () => {
    const qf = [...fullRound(3)!, ['japón ', 'Francia']] as PredictionData['qf'];
    expect(slotDetails('Japón', 1, ctx({ officialBracket: { qf } })).slotPoints).toBeNull();
    const usa = { ...part, final: ['EEUU', 'Brasil'] } as ViewerPrediction;
    const officialBracket = { final: ['Estados Unidos', 'Francia'] };
    expect(slotDetails('EEUU', 3, ctx({ part: usa, officialBracket })).slotPoints).toBeNull();
  });

  it('gives 0 to a team already knocked out, before the round fills up', () => {
    const lost = game({
      round: 'r16',
      finished: true,
      home: 'Japón',
      away: 'Francia',
      home_score: 0,
      away_score: 1,
    });
    expect(slotDetails('Japón', 1, ctx({ allGames: [lost] })).slotPoints).toBe('0');
    const officialPoints: GroupStandings = { A: { Japón: standing({ status: -1 }) } };
    expect(slotDetails('Japón', 1, ctx({ officialPoints })).slotPoints).toBe('0');
  });

  it('says nothing about a team the prediction does not send through', () => {
    const officialBracket = { qf: fullRound(4) };
    expect(slotDetails('Portugal', 1, ctx({ officialBracket }))).toEqual({
      isWinner: false,
      slotPoints: null,
    });
  });

  it('scores the runner-up slot even though that team does not win the final', () => {
    const officialBracket = { final: ['España', 'Francia'] };
    expect(slotDetails('Brasil', 'final', ctx({ officialBracket }))).toEqual({
      isWinner: false,
      slotPoints: '0',
    });
    expect(slotDetails('España', 'final', ctx({ officialBracket })).slotPoints).toBeNull();
  });

  it('gives 0 to a finalist that lost its semifinal', () => {
    const allGames = [semifinal('Francia', 'Brasil')];
    expect(slotDetails('Brasil', 'final', ctx({ allGames })).slotPoints).toBe('0');
    expect(slotDetails('Brasil', 'champion', ctx({ allGames })).slotPoints).toBe('0');
  });

  it('decides the champion slot only when there is an official champion', () => {
    expect(slotDetails('España', 'champion', ctx()).slotPoints).toBeNull();
    expect(
      slotDetails('España', 'champion', ctx({ officialBracket: { champion: 'España' } }))
        .slotPoints,
    ).toBeNull();
    expect(
      slotDetails('España', 'champion', ctx({ officialBracket: { champion: 'Francia' } }))
        .slotPoints,
    ).toBe('0');
  });

  describe('third place match', () => {
    it('keeps open the slot of a team that lost its semifinal: it plays that match', () => {
      const allGames = [semifinal('España', 'Italia')];
      expect(slotDetails('Italia', 'thirdPlaceMatch', ctx({ allGames })).slotPoints).toBeNull();
    });

    it('gives 0 to a team that won its semifinal: it plays the final instead', () => {
      const allGames = [semifinal('Italia', 'España')];
      expect(slotDetails('Italia', 'thirdPlaceMatch', ctx({ allGames })).slotPoints).toBe('0');
      const officialBracket = { final: ['Italia', 'Francia'] };
      expect(slotDetails('Italia', 'thirdPlaceMatch', ctx({ officialBracket })).slotPoints).toBe(
        '0',
      );
    });

    it('gives 0 to a team knocked out before the semifinals', () => {
      const quarterFinal = game({
        round: 'qf',
        finished: true,
        home: 'Italia',
        away: 'Francia',
        winner: 'Francia',
      });
      // Otra semifinal jugada, sin Italia, no la devuelve al partido.
      const allGames = [quarterFinal, semifinal('Francia', 'Brasil')];
      expect(slotDetails('Italia', 'thirdPlaceMatch', ctx({ allGames })).slotPoints).toBe('0');
    });

    it('gives 0 once the official match is set without the team', () => {
      const officialBracket = { thirdPlaceMatch: ['Francia', 'Japón'] };
      expect(slotDetails('Italia', 'thirdPlaceMatch', ctx({ officialBracket })).slotPoints).toBe(
        '0',
      );
      expect(
        slotDetails('Japón', 'thirdPlaceMatch', ctx({ officialBracket })).slotPoints,
      ).toBeNull();
    });
  });
});

describe('roundFooterTotal', () => {
  const round = [
    { home: 'España', away: 'Italia' },
    { home: 'Brasil', away: 'Japón' },
  ];

  it('adds the entries of every team that advances from the column', () => {
    const points = pointsWith([
      { stage: 'qf', amount: 40, msg: 'España pasa a semifinales' },
      { stage: 'qf', amount: 40, msg: 'Japón pasa a semifinales' },
      { stage: 'qf', amount: 0, msg: 'Italia no pasa a semifinales' },
      { stage: 'r16', amount: 30, msg: 'Brasil pasa a cuartos' },
    ]);
    expect(roundFooterTotal(round, 2, part, points)).toBe(80);
  });

  it('is 0 for a column without matches, without log or beyond the semifinals', () => {
    const points = pointsWith([{ stage: 'finals', amount: 200, msg: 'Campeón: España' }]);
    expect(roundFooterTotal(undefined, 2, part, points)).toBe(0);
    expect(roundFooterTotal(round, 4, part, points)).toBe(0);
    expect(roundFooterTotal(round, 2, part, pointsWith(null))).toBe(0);
  });
});

describe('centerPointsTotal', () => {
  it('is 0 without a finals total and without log', () => {
    expect(centerPointsTotal(pointsWith(null))).toBe(0);
    expect(centerPointsTotal(pointsWith([{ stage: 'sf', amount: 60, msg: 'España' }]))).toBe(0);
  });
});

describe('groupTeamData', () => {
  const odds = { A: [] } as GroupOdds;
  const standings: GroupStandings = {
    a: {
      'Bosnia y Her': standing({ mp: 2, status: 2 }),
      EEUU: standing({ mp: 2 }),
    },
  };

  it('is neutral until the standings and the group teams have loaded', () => {
    const neutral = { color: 'inherit', mp: 0, status: 0 };
    expect(groupTeamData('a', 'EEUU', 1, pointsWith([]), null, odds)).toEqual(neutral);
    expect(groupTeamData('a', 'EEUU', 1, pointsWith([]), standings, null)).toEqual(neutral);
    expect(groupTeamData('a', 'Francia', 1, pointsWith([]), standings, odds)).toEqual(neutral);
  });

  it('finds a team whose name the standings store without dots', () => {
    expect(groupTeamData('a', 'Bosnia y Her.', 2, pointsWith([]), standings, odds)).toEqual({
      color: 'var(--miss)',
      mp: 2,
      status: 2,
    });
  });

  it('reads exact positions by the group letter in either case', () => {
    const upper = pointsWith([], { exactMatches: { A: { 1: true } } });
    expect(groupTeamData('a', 'EEUU', 1, upper, standings, odds).color).toBe('var(--hit)');
    expect(groupTeamData('a', 'EEUU', 2, upper, standings, odds).color).toBe('var(--miss)');
    const lower = pointsWith([], { exactMatches: { a: { 1: true } } });
    expect(groupTeamData('a', 'EEUU', 1, lower, standings, odds).color).toBe('var(--hit)');
  });

  it('counts a qualified EEUU under either of its names', () => {
    const points = pointsWith([], { passedTeams: { 'Estados Unidos': true } });
    expect(groupTeamData('a', 'EEUU', 2, points, standings, odds).color).toBe('var(--pass)');
  });

  it('marks a miss when the score has no breakdown yet', () => {
    const bare = pointsWith([], { exactMatches: null, passedTeams: null });
    expect(groupTeamData('a', 'EEUU', 1, bare, standings, odds).color).toBe('var(--miss)');
  });
});

describe('groupTeamPoints', () => {
  it('adds the entries of the team in its group, under either name of EEUU', () => {
    const points = pointsWith([
      { stage: 'r1', amount: 10, msg: 'Grupo D: Estados Unidos clasificado' },
      { stage: 'r1', amount: 10, msg: 'Grupo D: Estados Unidos, posición exacta' },
      { stage: 'r1', amount: 10, msg: 'Grupo D: Paraguay clasificado' },
    ]);
    expect(groupTeamPoints(points, 'D', 'EEUU')).toBe(20);
    expect(groupTeamPoints(points, 'D', 'Australia')).toBe(0);
    expect(groupTeamPoints(pointsWith(null), 'D', 'EEUU')).toBe(0);
  });
});

describe('featuredSlot', () => {
  const next = game({ round: 'sf', home: 'España', away: 'Por definir', status: 'IN_PLAY' });

  it('never highlights a slot without a real team', () => {
    expect(featuredSlot(next, 'Por definir', 3).isFeatured).toBe(false);
    expect(featuredSlot(next, null, 3).isFeatured).toBe(false);
  });

  it('is not live without a rival or once the match has finished', () => {
    expect(featuredSlot(next, 'España', 3)).toEqual({ isFeatured: true, isLive: false });
    const played = { ...next, away: 'Italia', finished: true };
    expect(featuredSlot(played, 'Italia', 3)).toEqual({ isFeatured: true, isLive: false });
    expect(featuredSlot({ ...played, finished: false }, 'Italia', 3).isLive).toBe(true);
  });

  it('matches the third place match only with its own slot', () => {
    const third = game({ round: 'third', home: 'Italia', away: 'Japón' });
    expect(featuredSlot(third, 'Italia', 'thirdPlaceMatch').isFeatured).toBe(true);
    expect(featuredSlot(third, 'Italia', 'final').isFeatured).toBe(false);
  });
});
