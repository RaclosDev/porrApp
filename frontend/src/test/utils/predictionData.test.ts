import { describe, expect, it } from 'vitest';
import type { GroupOdds, GroupStandings, PredictionData, TournamentFormat } from '../../types/api';
import { buildR32FromGroups } from '../../utils/bracketDraft';
import {
  checkIsKnockoutPhase,
  injectQualifiedTeams,
  normalizePart,
} from '../../utils/predictionData';
import { game, standing } from '../fixtures';

const PAST = '2000-01-01T00:00:00Z';
const FUTURE = '2999-01-01T00:00:00Z';

describe('checkIsKnockoutPhase', () => {
  it('is false with no matches and no official bracket', () => {
    expect(checkIsKnockoutPhase(null, null)).toBe(false);
    expect(checkIsKnockoutPhase([], undefined)).toBe(false);
  });

  it('ignores group-stage matches, even finished ones', () => {
    const games = ['group', 'r1', '1'].map((round) =>
      game({ round, finished: true, home: 'España', away: 'Italia', home_score: 2, away_score: 0 }),
    );
    expect(checkIsKnockoutPhase(games, null)).toBe(false);
  });

  it('starts with a knockout match that is finished or already has a score', () => {
    expect(checkIsKnockoutPhase([game({ round: 'r32', finished: true })], null)).toBe(true);
    expect(checkIsKnockoutPhase([game({ round: 'r16', home_score: 0 })], null)).toBe(true);
    expect(checkIsKnockoutPhase([game({ round: 'r16', away_score: 1 })], null)).toBe(true);
  });

  it('starts once a knockout match has a real home team', () => {
    expect(checkIsKnockoutPhase([game({ round: 'r32', home: 'España', date: FUTURE })], null)).toBe(
      true,
    );
  });

  it('does not start while knockout matches only have placeholders and a future date', () => {
    const games = ['Por definir', 'TBD', '1º Grupo A', ''].map((home) =>
      game({ round: 'r32', home, date: FUTURE }),
    );
    expect(checkIsKnockoutPhase(games, null)).toBe(false);
    expect(checkIsKnockoutPhase([game({ round: 'r32', home: 'Por definir' })], null)).toBe(false);
  });

  it('starts when a knockout match date has passed, whoever plays it', () => {
    expect(
      checkIsKnockoutPhase([game({ round: 'r32', home: 'Por definir', date: PAST })], null),
    ).toBe(true);
  });

  it('falls back to the official bracket: any real team in a knockout round counts', () => {
    const placeholders: PredictionData = {
      r32: [
        ['1º Grupo A', '2º Grupo B'],
        ['Por definir', '???'],
      ],
      r16: [[null, null]],
      final: [],
    };
    expect(checkIsKnockoutPhase([], placeholders)).toBe(false);
    expect(checkIsKnockoutPhase([], { ...placeholders, sf: [['España', null]] })).toBe(true);
    expect(checkIsKnockoutPhase(null, { final: ['España', 'Brasil'] })).toBe(true);
    expect(checkIsKnockoutPhase(null, { thirdPlaceMatch: ['Italia'] })).toBe(true);
  });

  it('lets the official bracket decide when the matches say nothing yet', () => {
    const games = [game({ round: 'r32', home: 'Por definir', date: FUTURE })];
    expect(checkIsKnockoutPhase(games, { r32: [['España', '2º Grupo B']] })).toBe(true);
  });
});

describe('injectQualifiedTeams', () => {
  const bracket: PredictionData = {
    r32: [
      ['1º Grupo A', '2º Grupo B'],
      ['1º Grupo B', '2º Grupo A'],
      ['1º Grupo C', '3º A/B/C'],
      ['Francia', null],
    ],
  };

  it('returns the bracket untouched without first round or standings', () => {
    const noRound: PredictionData = { r16: [['España', 'Italia']] };
    expect(injectQualifiedTeams(noRound, {})).toBe(noRound);
    expect(injectQualifiedTeams(bracket, null)).toBe(bracket);
    expect(injectQualifiedTeams(null, {})).toBeNull();
  });

  it('fills the slots of the teams that have clinched first or second place', () => {
    const standings: GroupStandings = {
      A: { España: standing({ status: 1 }), Italia: standing({ status: 2 }) },
      B: { Brasil: standing({ status: 2 }), Japón: standing({ status: 0 }) },
    };
    expect(injectQualifiedTeams(bracket, standings)?.r32).toEqual([
      ['España', 'Brasil'],
      ['1º Grupo B', 'Italia'],
      ['1º Grupo C', '3º A/B/C'],
      ['Francia', null],
    ]);
  });

  it('names both candidates while two qualified teams still fight for first place', () => {
    const standings: GroupStandings = {
      A: { España: standing({ status: 5 }), Italia: standing({ status: 5 }) },
    };
    const r32 = injectQualifiedTeams(bracket, standings)?.r32;
    expect(r32?.[0][0]).toBe('España / Italia');
    expect(r32?.[1][1]).toBe('España / Italia');
  });

  it('gives a qualified team the place the group leader has left free', () => {
    const standings: GroupStandings = {
      A: { España: standing({ status: 1 }), Italia: standing({ status: 5 }) },
    };
    const r32 = injectQualifiedTeams(bracket, standings)?.r32;
    expect(r32?.[0][0]).toBe('España');
    expect(r32?.[1][1]).toBe('Italia');
  });

  it('does not mutate the bracket it receives (it may live in the query cache)', () => {
    const original = JSON.parse(JSON.stringify(bracket));
    const standings: GroupStandings = { A: { España: standing({ status: 1 }) } };
    const result = injectQualifiedTeams(bracket, standings);
    expect(result).not.toBe(bracket);
    expect(bracket).toEqual(original);
  });
});

describe('normalizePart', () => {
  const sf: PredictionData['sf'] = [
    ['A', 'B'],
    ['C', 'D'],
  ];

  it('returns null without a prediction and never mutates the one it gets', () => {
    expect(normalizePart(null, {})).toBeNull();
    const part: PredictionData = { sf, champion: 'A' };
    const snapshot = JSON.parse(JSON.stringify(part));
    const normalized = normalizePart(part, {});
    expect(normalized).not.toBe(part);
    expect(part).toEqual(snapshot);
  });

  it('rebuilds the final of an old prediction from the semifinals and the champion', () => {
    // Campeón en la primera semifinal: el otro finalista es quien no juega el tercer puesto.
    expect(normalizePart({ sf, champion: 'A', thirdPlaceMatch: ['B', 'D'] }, {})?.final).toEqual([
      'A',
      'C',
    ]);
    // Campeón en la segunda: se conserva el lado de cada finalista.
    expect(normalizePart({ sf, champion: 'D', thirdPlaceMatch: ['B', 'C'] }, {})?.final).toEqual([
      'A',
      'D',
    ]);
    // Sin tercer puesto guardado se toma el primero de la otra semifinal.
    expect(normalizePart({ sf, champion: 'C' }, {})?.final).toEqual(['A', 'C']);
  });

  it('leaves the final empty when the champion did not play a semifinal', () => {
    expect(normalizePart({ sf, champion: 'Z' }, {})?.final).toBeUndefined();
    expect(normalizePart({ sf: [['A', 'B']], champion: 'A' }, {})?.final).toBeUndefined();
    expect(normalizePart({ sf }, {})?.final).toBeUndefined();
  });

  it('keeps a final that is already complete', () => {
    expect(normalizePart({ sf, champion: 'A', final: ['B', 'D'] }, {})?.final).toEqual(['B', 'D']);
  });

  it('derives the third place match from the semifinalists that miss the final', () => {
    expect(normalizePart({ sf, final: ['A', 'D'] }, {})?.thirdPlaceMatch).toEqual(['B', 'C']);
    // Final reconstruida y tercer puesto deducido en la misma pasada.
    const rebuilt = normalizePart({ sf, champion: 'B' }, {});
    expect(rebuilt?.final).toEqual(['B', 'C']);
    expect(rebuilt?.thirdPlaceMatch).toEqual(['A', 'D']);
  });

  it('keeps a stored third place match and adds none to a tournament without one', () => {
    expect(
      normalizePart({ sf, final: ['A', 'D'], thirdPlaceMatch: ['C', 'B'] }, {})?.thirdPlaceMatch,
    ).toEqual(['C', 'B']);
    const noThirdPlace: TournamentFormat = {
      groups: ['A', 'B', 'C', 'D'],
      bestThirds: 0,
      thirdPlaceMatch: false,
      firstRound: 'qf',
      firstKnockoutRound: [
        ['1A', '2B'],
        ['1C', '2D'],
        ['1B', '2A'],
        ['1D', '2C'],
      ],
    };
    expect(
      normalizePart({ sf, final: ['A', 'D'] }, {}, noThirdPlace)?.thirdPlaceMatch,
    ).toBeUndefined();
  });

  describe('groups and first round', () => {
    const groups = Object.fromEntries(
      'ABCDEFGHIJKL'.split('').map((g) => [g, [`${g}1`, `${g}2`, `${g}3`]]),
    );
    const thirds = ['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3'];
    const r32 = buildR32FromGroups(groups, thirds, 2) as [string, string][];
    const odds = Object.fromEntries(
      Object.entries(groups).map(([g, teams]) => [g, teams.map((name) => ({ name }))]),
    ) as unknown as GroupOdds;

    it('recovers group positions and best thirds from a stored round of 32', () => {
      const normalized = normalizePart({ topologyVersion: 2, r32 }, odds);
      expect(Object.keys(normalized?.groups ?? {}).sort()).toEqual('ABCDEFGHIJKL'.split(''));
      expect(normalized?.groups?.E).toEqual({ first: 'E1', second: 'E2', third: 'E3' });
      // El tercero de un grupo que no pasa como mejor tercero no se puede deducir del cuadro.
      expect(normalized?.groups?.L).toEqual({ first: 'L1', second: 'L2', third: '' });
      expect([...(normalized?.thirds ?? [])].sort()).toEqual(thirds);
    });

    it('keeps the thirds the user stored instead of the deduced ones', () => {
      const stored = ['H3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B3', 'A3'];
      expect(normalizePart({ topologyVersion: 2, r32, thirds: stored }, odds)?.thirds).toEqual(
        stored,
      );
    });

    it('reads the round of 32 that old predictions stored as r1', () => {
      const normalized = normalizePart({ topologyVersion: 2, r1: r32 }, odds);
      expect(normalized?.r32).toEqual(r32);
      expect(normalized?.groups?.A).toEqual({ first: 'A1', second: 'A2', third: 'A3' });
    });

    it('builds the round of 32 from the groups when only the groups were stored', () => {
      expect(normalizePart({ topologyVersion: 2, groups, thirds }, odds)?.r32).toEqual(r32);
    });

    it('leaves a prediction with neither groups nor a full first round as it is', () => {
      const partial = normalizePart({ topologyVersion: 2, r32: r32.slice(0, 4) }, odds);
      expect(partial?.groups).toBeUndefined();
      expect(partial?.r32).toHaveLength(4);
      const placeholders = normalizePart({ groups: { A: ['1º Grupo A', '???'] } }, odds);
      expect(placeholders?.r32).toBeUndefined();
    });

    it('does not invent a round of 32 for a tournament that starts later', () => {
      const eightTeams: TournamentFormat = {
        groups: ['A', 'B', 'C', 'D'],
        bestThirds: 0,
        thirdPlaceMatch: false,
        firstRound: 'qf',
        firstKnockoutRound: [
          ['1A', '2B'],
          ['1C', '2D'],
          ['1B', '2A'],
          ['1D', '2C'],
        ],
      };
      const qf: PredictionData['qf'] = [
        ['A1', 'B2'],
        ['C1', 'D2'],
        ['B1', 'A2'],
        ['D1', 'C2'],
      ];
      const normalized = normalizePart({ qf }, {}, eightTeams);
      expect(normalized?.r32).toBeUndefined();
      expect(normalized?.groups).toEqual({
        A: { first: 'A1', second: 'A2', third: '' },
        B: { first: 'B1', second: 'B2', third: '' },
        C: { first: 'C1', second: 'C2', third: '' },
        D: { first: 'D1', second: 'D2', third: '' },
      });
    });
  });
});
