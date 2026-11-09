import { describe, expect, it } from 'vitest';
import type { GroupOdds, GroupStandings, Match, TournamentFormat } from '../../types/api';
import {
  buildBracketData,
  isMatchInRound,
  matchTeamNames,
  matchWinner,
  nextWorldCupKnockoutMatch,
  slotName,
} from '../../utils/bracketBuilder';
import { game, standing } from '../fixtures';

/** Torneo de cuatro equipos: dos grupos y semifinales cruzadas. */
const FOUR_TEAMS: TournamentFormat = {
  groups: ['A', 'B'],
  bestThirds: 0,
  thirdPlaceMatch: true,
  firstRound: 'sf',
  firstKnockoutRound: [
    ['1A', '2B'],
    ['1B', '2A'],
  ],
};

const standings: GroupStandings = {
  A: { Italia: standing({ pos: 2 }), España: standing({ pos: 1 }) },
  B: { Brasil: standing({ pos: 1 }), Japón: standing({ pos: 2 }) },
};

const played = (round: string, home: string, away: string, score: [number, number]): Match =>
  game({ round, home, away, home_score: score[0], away_score: score[1], finished: true });

const build = (games: Match[], format = FOUR_TEAMS, points = standings, odds: GroupOdds = {}) =>
  buildBracketData(points, odds, games, format);

describe('matchWinner', () => {
  it('trusts the official winner, which also settles a draw decided on penalties', () => {
    expect(
      matchWinner(game({ home: 'A', away: 'B', home_score: 1, away_score: 1, winner: 'B' })),
    ).toBe('B');
  });

  it('otherwise takes whoever is ahead, and nobody in a draw or without a score', () => {
    expect(matchWinner(game({ home: 'A', away: 'B', home_score: 2, away_score: 1 }))).toBe('A');
    expect(matchWinner(game({ home: 'A', away: 'B', home_score: 0, away_score: 3 }))).toBe('B');
    expect(matchWinner(game({ home: 'A', away: 'B', home_score: 1, away_score: 1 }))).toBeNull();
    expect(matchWinner(game({ home: 'A', away: 'B', home_score: 1 }))).toBeNull();
  });
});

describe('matchTeamNames', () => {
  it('matches the same team across spellings and the two names of EEUU', () => {
    expect(matchTeamNames('España', 'España')).toBe(true);
    expect(matchTeamNames(' españa', 'ESPAÑA ')).toBe(true);
    expect(matchTeamNames('EEUU', 'Estados Unidos')).toBe(true);
    expect(matchTeamNames('Estados Unidos', 'EEUU')).toBe(true);
  });

  it('never matches an empty slot or a different team', () => {
    expect(matchTeamNames('España', 'Italia')).toBe(false);
    expect(matchTeamNames(null, null)).toBe(false);
    expect(matchTeamNames('España', undefined)).toBe(false);
  });
});

describe('slotName', () => {
  it('reads the name of a known team, of a computed winner and of an empty slot', () => {
    expect(slotName('España')).toBe('España');
    expect(slotName({ name: 'Italia', isProvisional: true })).toBe('Italia');
    expect(slotName(null)).toBeNull();
    expect(slotName(undefined)).toBeNull();
  });
});

describe('isMatchInRound', () => {
  it('accepts any match when the slot has no round', () => {
    expect(isMatchInRound(game({ round: 'group', groupName: 'A' }), undefined)).toBe(true);
  });

  it('recognises each round by the names the provider uses', () => {
    expect(isMatchInRound(game({ round: 'r32' }), 0)).toBe(true);
    expect(isMatchInRound(game({ round: 'r16' }), 1)).toBe(true);
    expect(isMatchInRound(game({ round: 'Octavos de final' }), 1)).toBe(true);
    expect(isMatchInRound(game({ round: 'Cuartos de final' }), 2)).toBe(true);
    expect(isMatchInRound(game({ round: 'Quarter-finals' }), 2)).toBe(true);
    expect(isMatchInRound(game({ round: 'Semifinal' }), 3)).toBe(true);
    expect(isMatchInRound(game({ round: 'Final' }), 'final')).toBe(true);
    expect(isMatchInRound(game({ round: 'Tercer puesto' }), 'thirdPlaceMatch')).toBe(true);
  });

  it('keeps each match out of the other rounds', () => {
    expect(isMatchInRound(game({ round: 'r16' }), 0)).toBe(false);
    expect(isMatchInRound(game({ round: 'qf' }), 3)).toBe(false);
    expect(isMatchInRound(game({ round: 'sf' }), 2)).toBe(false);
    expect(isMatchInRound(game({ round: 'final' }), 'thirdPlaceMatch')).toBe(false);
    expect(isMatchInRound(game({ round: 'third' }), 'final')).toBe(false);
  });

  it('never takes a group or league match for a knockout one', () => {
    expect(isMatchInRound(game({ round: 'final', groupName: 'A' }), 'final')).toBe(false);
    expect(isMatchInRound(game({ round: 'Grupo A' }), 0)).toBe(false);
    expect(isMatchInRound(game({ round: 'Jornada 32' }), 0)).toBe(false);
    expect(isMatchInRound(game({ round: 'group-16' }), 1)).toBe(false);
    // Un partido sin grupo real ("-" o espacios) sí es de eliminatorias.
    expect(isMatchInRound(game({ round: 'sf', groupName: '-' }), 3)).toBe(true);
    expect(isMatchInRound(game({ round: 'sf', groupName: '  ' }), 3)).toBe(true);
  });
});

describe('nextWorldCupKnockoutMatch', () => {
  it('picks the earliest knockout match still to be played', () => {
    const games = [
      game({ id: 1, round: 'qf', date: '2026-07-10T18:00:00Z' }),
      game({ id: 2, round: 'r16', date: '2026-07-04T18:00:00Z' }),
      game({ id: 3, round: 'sf' }),
    ];
    expect(nextWorldCupKnockoutMatch(games)?.id).toBe(2);
  });

  it('skips group matches and knockout matches already started or decided', () => {
    const games = [
      game({ id: 1, round: 'group', groupName: 'A', date: '2026-06-11T18:00:00Z' }),
      game({ id: 2, round: 'r32', date: '2026-06-28T18:00:00Z', finished: true }),
      game({ id: 3, round: 'r32', date: '2026-06-29T18:00:00Z', winner: 'España' }),
      game({ id: 4, round: 'r32', date: '2026-06-30T18:00:00Z', home_score: 0, away_score: 0 }),
      game({ id: 5, round: 'r32', date: '2026-07-01T18:00:00Z' }),
    ];
    expect(nextWorldCupKnockoutMatch(games)?.id).toBe(5);
  });

  it('has nothing to highlight without matches or once all are played', () => {
    expect(nextWorldCupKnockoutMatch(null)).toBeNull();
    expect(nextWorldCupKnockoutMatch([])).toBeNull();
    expect(nextWorldCupKnockoutMatch([game({ round: 'final', finished: true })])).toBeNull();
  });
});

describe('buildBracketData: tournament that starts in the semifinals', () => {
  it('fills its first round from the group standings and leaves earlier rounds empty', () => {
    const bracket = build([]);

    expect(bracket.sf).toEqual([
      ['España', 'Japón'],
      ['Brasil', 'Italia'],
    ]);
    expect(bracket).toMatchObject({ topologyVersion: 2, r32: [], r16: [], qf: [] });
    expect(bracket.final).toEqual([null, null]);
    expect(bracket.thirdPlaceMatch).toEqual([null, null]);
    expect(bracket.champion).toBeNull();
    expect(bracket.thirdPlaceWinner).toBeNull();
  });

  it('keeps the slot label of a group that has no standings yet', () => {
    const bracket = build([], FOUR_TEAMS, { A: standings.A });

    expect(bracket.sf).toEqual([
      ['España', '2º Grupo B'],
      ['1º Grupo B', 'Italia'],
    ]);
  });

  it('tolerates missing standings and matches', () => {
    const bracket = buildBracketData(
      null as unknown as GroupStandings,
      null as unknown as GroupOdds,
      null as unknown as Match[],
      FOUR_TEAMS,
    );

    expect(bracket.sf).toEqual([
      ['1º Grupo A', '2º Grupo B'],
      ['1º Grupo B', '2º Grupo A'],
    ]);
  });

  it('shows the full name of a team the standings store without dots', () => {
    const points: GroupStandings = {
      ...standings,
      A: { 'Bosnia y Her': standing({ pos: 1 }), Italia: standing({ pos: 2 }) },
    };
    const odds = {
      A: [{ name: 'Bosnia y Her.' }, { name: 'Italia' }],
    } as unknown as GroupOdds;

    expect(build([], FOUR_TEAMS, points, odds).sf[0][0]).toBe('Bosnia y Her.');
  });

  it('sends semifinal winners to the final and losers to the third place match', () => {
    const bracket = build([
      played('sf', 'España', 'Japón', [2, 0]),
      // Empate resuelto en los penaltis: manda el ganador oficial.
      { ...played('sf', 'Italia', 'Brasil', [1, 1]), winner: 'Italia' },
    ]);

    expect(bracket.final).toEqual([
      { name: 'España', isProvisional: false },
      { name: 'Italia', isProvisional: false },
    ]);
    expect(bracket.thirdPlaceMatch).toEqual([
      { name: 'Japón', isProvisional: false },
      { name: 'Brasil', isProvisional: false },
    ]);
    expect(bracket.champion).toBeNull();
  });

  it('marks as provisional the team ahead in a semifinal still being played', () => {
    const live = { ...played('sf', 'España', 'Japón', [0, 1]), finished: false };

    const bracket = build([live]);

    expect(bracket.final).toEqual([{ name: 'Japón', isProvisional: true }, null]);
    expect(bracket.thirdPlaceMatch).toEqual([{ name: 'España', isProvisional: true }, null]);
  });

  it('advances nobody from a semifinal that is level or has not started', () => {
    const level = { ...played('sf', 'España', 'Japón', [1, 1]), finished: false };

    const bracket = build([level, game({ round: 'sf', home: 'Brasil', away: 'Italia' })]);

    expect(bracket.final).toEqual([null, null]);
    expect(bracket.thirdPlaceMatch).toEqual([null, null]);
  });

  it('finds a semifinal the provider lists under the other name of EEUU', () => {
    const points: GroupStandings = {
      ...standings,
      A: { EEUU: standing({ pos: 1 }), Italia: standing({ pos: 2 }) },
    };

    const bracket = build([played('sf', 'Japón', 'Estados Unidos', [0, 1])], FOUR_TEAMS, points);

    expect(bracket.final[0]).toEqual({ name: 'Estados Unidos', isProvisional: false });
    expect(bracket.thirdPlaceMatch?.[0]).toEqual({ name: 'Japón', isProvisional: false });
  });

  it('takes the final the provider publishes, on the side each finalist comes from', () => {
    const final = game({ round: 'final', home: 'Italia', away: 'España' });

    const bracket = build([final]);

    expect(bracket.final).toEqual(['España', 'Italia']);
    expect(bracket.champion).toBeNull();
  });

  it('crowns a provisional champion during the final and a definitive one at the end', () => {
    const semis = [
      played('sf', 'España', 'Japón', [2, 0]),
      played('sf', 'Brasil', 'Italia', [0, 1]),
    ];
    const final = played('final', 'España', 'Italia', [1, 0]);
    const third = played('third', 'Japón', 'Brasil', [0, 2]);

    const live = build([...semis, { ...final, finished: false }, { ...third, finished: false }]);
    expect(live.champion).toEqual({ name: 'España', isProvisional: true });
    expect(live.thirdPlaceWinner).toEqual({ name: 'Brasil', isProvisional: true });

    const over = build([...semis, final, third]);
    expect(over.champion).toEqual({ name: 'España', isProvisional: false });
    expect(over.thirdPlaceWinner).toEqual({ name: 'Brasil', isProvisional: false });
  });

  it('has no third place match in a tournament that does not play one', () => {
    const noThird = { ...FOUR_TEAMS, thirdPlaceMatch: false };
    const games = [
      played('sf', 'España', 'Japón', [2, 0]),
      played('sf', 'Brasil', 'Italia', [0, 1]),
      played('third', 'Japón', 'Brasil', [0, 2]),
    ];

    const bracket = build(games, noThird);

    expect(bracket.thirdPlaceMatch).toBeNull();
    expect(bracket.thirdPlaceWinner).toBeNull();
    expect(bracket.final).toHaveLength(2);
  });
});

describe('buildBracketData: tournament with best thirds', () => {
  /** Tres grupos y cuartos de final: pasan los dos primeros y dos terceros. */
  const SIX_PLUS_TWO: TournamentFormat = {
    groups: ['A', 'B', 'C'],
    bestThirds: 2,
    thirdPlaceMatch: false,
    firstRound: 'qf',
    firstKnockoutRound: [
      ['1A', '3BC'],
      ['1B', '2C'],
      ['1C', '3AB'],
      ['2A', '2B'],
    ],
  };
  const points: GroupStandings = Object.fromEntries(
    ['A', 'B', 'C'].map((g) => [
      g,
      { [`${g}1`]: standing({ pos: 1 }), [`${g}2`]: standing({ pos: 2 }) },
    ]),
  );

  it('leaves a third-place slot open until the provider publishes that match', () => {
    const bracket = build([], SIX_PLUS_TWO, points);

    expect(bracket.qf).toEqual([
      ['A1', '3º B/C'],
      ['B1', 'C2'],
      ['C1', '3º A/B'],
      ['A2', 'B2'],
    ]);
    expect(bracket.sf).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('puts in the slot the third that the group winner really plays against', () => {
    const bracket = build(
      [
        game({ round: 'qf', home: 'B3', away: 'A1' }),
        game({ round: 'qf', home: 'C1', away: 'Por definir' }),
      ],
      SIX_PLUS_TWO,
      points,
    );

    expect(bracket.qf[0]).toEqual(['A1', 'B3']);
    expect(bracket.qf[2]).toEqual(['C1', '3º A/B']);
  });

  it('advances first-round winners even while their rival is still an open slot', () => {
    const bracket = build(
      [played('qf', 'A1', 'B3', [2, 1]), { ...played('qf', 'C2', 'B1', [1, 0]), finished: false }],
      SIX_PLUS_TWO,
      points,
    );

    expect(bracket.sf).toEqual([
      [
        { name: 'A1', isProvisional: false },
        { name: 'C2', isProvisional: true },
      ],
      [null, null],
    ]);
  });

  it('prefers the semifinal the provider publishes over the computed winners', () => {
    const bracket = build(
      [
        played('qf', 'A1', 'B3', [2, 1]),
        played('qf', 'B1', 'C2', [0, 1]),
        { ...played('sf', 'C2', 'A1', [0, 2]), date: '2026-07-10T18:00:00Z' },
      ],
      SIX_PLUS_TWO,
      points,
    );

    expect(bracket.sf[0]).toEqual(['A1', 'C2']);
    expect(bracket.final).toEqual([{ name: 'A1', isProvisional: false }, null]);
  });
});
