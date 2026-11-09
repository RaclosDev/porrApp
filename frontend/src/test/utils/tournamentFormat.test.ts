import { describe, expect, it } from 'vitest';
import { isGroupTournament, leagueKindOf } from '../../context/leagueKind';
import { defaultBracketState, getDefaultBracketState } from '../../store/useAppStore';
import type { Match, TournamentFormat } from '../../types/api';
import { buildBracketData } from '../../utils/bracketBuilder';
import { reconstructBracketState } from '../../utils/bracketDraft';
import {
  applyGroupStage,
  buildBracketPrediction,
  hasPlaceholderSlots,
  hasShapeOf,
  isEmptyBracket,
} from '../../utils/bracketEditor';
import {
  advanceBracketWinner,
  firstRoundIndex,
  firstRoundMatches,
} from '../../utils/bracketTransitions';
import { isBracketState } from '../../utils/bracketValidation';
import { WORLD_CUP_2026_FORMAT, roundLabelsOf } from '../../utils/firstKnockoutRound';
import { solveThirdPlaceMatrix, thirdPlaceRules } from '../../utils/matrix';
import { bracketSides, r32Source } from '../../utils/predictionViewer';

/** Eurocopa: 6 grupos, pasan 4 terceros, el cuadro empieza en octavos y no hay tercer puesto. */
const EURO: TournamentFormat = {
  groups: 'ABCDEF'.split(''),
  bestThirds: 4,
  thirdPlaceMatch: false,
  firstRound: 'r16',
  firstKnockoutRound: [
    ['1B', '3ADEF'],
    ['1A', '2C'],
    ['1F', '3ABC'],
    ['2D', '2E'],
    ['1C', '3DEF'],
    ['2A', '2B'],
    ['1E', '3ABCD'],
    ['1D', '2F'],
  ],
};

const selections = Object.fromEntries(
  EURO.groups.map((group) => [
    group,
    { first: `${group}1`, second: `${group}2`, third: `${group}3` },
  ]),
);
const thirds = ['A3', 'B3', 'D3', 'E3'];

const filled = () => applyGroupStage(getDefaultBracketState(2, EURO), selections, thirds, EURO);

describe('cuadro de un torneo que no es el Mundial', () => {
  it('el cuadro vacío empieza en la ronda del torneo, con sus huecos de grupo', () => {
    const empty = getDefaultBracketState(2, EURO);

    expect(empty.r32).toEqual({ left: [], right: [] });
    expect(empty.r16.left).toHaveLength(4);
    expect(empty.r16.right).toHaveLength(4);
    expect(empty.r16.left[0].home?.name).toBe('1º Grupo B');
    expect(empty.r16.left[0].away?.name).toBe('3º A/D/E/F');
    expect(firstRoundIndex(empty)).toBe(1);
    expect(isBracketState(empty)).toBe(true);
    expect(isEmptyBracket(empty)).toBe(true);
    expect(hasShapeOf(empty, EURO)).toBe(true);
    expect(hasShapeOf(defaultBracketState, EURO)).toBe(false);
    expect(roundLabelsOf(EURO)).toEqual(['Octavos', 'Cuartos', 'Semis']);
  });

  it('el Mundial conserva su cuadro de siempre', () => {
    expect(getDefaultBracketState(2)).toBe(defaultBracketState);
    expect(getDefaultBracketState(2, WORLD_CUP_2026_FORMAT)).toBe(defaultBracketState);
    expect(hasShapeOf(defaultBracketState, WORLD_CUP_2026_FORMAT)).toBe(true);
    expect(firstRoundIndex(defaultBracketState)).toBe(0);
    expect(roundLabelsOf(WORLD_CUP_2026_FORMAT)).toEqual(['16avos', 'Octavos', 'Cuartos', 'Semis']);
  });

  it('una ronda vacía después de otra con cruces no es un cuadro válido', () => {
    const broken = { ...getDefaultBracketState(2, EURO), qf: { left: [], right: [] } };
    expect(isBracketState(broken)).toBe(false);
  });

  it('reparte a los terceros que pasan en los huecos que los admiten', () => {
    const rules = thirdPlaceRules(EURO.firstKnockoutRound);
    expect(rules.map((rule) => rule.allowed.join(''))).toEqual(['ADEF', 'ABC', 'DEF', 'ABCD']);
    const solved = solveThirdPlaceMatrix(
      thirds.map((team) => ({ team, group: team[0] })),
      rules,
    );
    expect(solved?.map((third) => third.team)).toEqual(['A3', 'B3', 'E3', 'D3']);
    // Hacen falta tantos terceros como huecos.
    expect(solveThirdPlaceMatrix([{ team: 'A3', group: 'A' }], rules)).toBeNull();
  });

  it('la fase de grupos rellena la primera ronda del torneo', () => {
    const state = filled();

    expect(firstRoundMatches(state).map((match) => [match.home?.name, match.away?.name])).toEqual([
      ['B1', 'A3'],
      ['A1', 'C2'],
      ['F1', 'B3'],
      ['D2', 'E2'],
      ['C1', 'E3'],
      ['A2', 'B2'],
      ['E1', 'D3'],
      ['D1', 'F2'],
    ]);
    expect(hasPlaceholderSlots(state)).toBe(false);
    expect(isEmptyBracket(state)).toBe(false);
  });

  it('quien gana en octavos pasa a cuartos, y la predicción no lleva rondas que no se juegan', () => {
    let state = advanceBracketWinner(filled(), { name: 'B1' }, 'left', 1, 0);
    state = advanceBracketWinner(state, { name: 'A1' }, 'left', 1, 1);
    expect(state.qf.left[0].home?.name).toBe('B1');
    expect(state.qf.left[0].away?.name).toBe('A1');

    const prediction = buildBracketPrediction({
      state,
      userName: 'Ana',
      predictionName: 'Mi porra',
      topScorer: '',
      groups: selections,
      thirds,
      knockoutsOnly: false,
      thirdPlaceMatch: EURO.thirdPlaceMatch,
    });
    expect(prediction.r32).toBeUndefined();
    expect(prediction.r1).toBeUndefined();
    expect(prediction.r16).toHaveLength(8);
    expect(prediction.r16?.[0]).toEqual(['B1', 'A3']);
    expect(prediction.qf?.[0]).toEqual(['B1', 'A1']);
    expect(prediction.thirdPlaceMatch).toBeUndefined();
    expect(prediction.thirds).toEqual(thirds);

    const restored = reconstructBracketState(prediction, EURO);
    expect(restored && isBracketState(restored)).toBe(true);
    expect(restored && hasShapeOf(restored, EURO)).toBe(true);
    expect(restored?.r32).toEqual({ left: [], right: [] });
    expect(restored?.r16.left[0].home?.name).toBe('B1');
    expect(restored?.r16.right[3].away?.name).toBe('F2');
    expect(restored?.qf.left[0].away?.name).toBe('A1');
  });

  it('el visor no pinta dieciseisavos en un torneo que empieza en octavos', () => {
    const part = {
      r16: firstRoundMatches(filled()).map((match) => [match.home?.name, match.away?.name]),
      qf: [],
      sf: [],
    } as never;
    const { leftRounds, rightRounds } = bracketSides(r32Source(part, EURO), part);

    expect(leftRounds[0]).toEqual([]);
    expect(rightRounds[0]).toEqual([]);
    expect(leftRounds[1]).toHaveLength(4);
    expect(rightRounds[1][3]).toEqual({ home: 'D1', away: 'F2' });
  });

  it('el cuadro oficial empieza en la ronda del torneo y no tiene tercer puesto', () => {
    const game = (round: string, home: string, away: string, winner: string): Match =>
      ({
        round,
        home,
        away,
        winner,
        finished: true,
        home_score: 1,
        away_score: 0,
        date: '2024-06-29T16:00:00Z',
      }) as Match;
    const official = buildBracketData(
      {},
      {},
      [game('r16', 'Suiza', 'Italia', 'Suiza'), game('r16', 'Alemania', 'Dinamarca', 'Alemania')],
      EURO,
    );

    expect(official.r32).toEqual([]);
    expect(official.r16).toHaveLength(8);
    expect(official.r16[0]).toEqual(['1º Grupo B', '3º A/D/E/F']);
    expect(official.qf).toHaveLength(4);
    expect(official.sf).toHaveLength(2);
    expect(official.thirdPlaceMatch).toBeNull();
  });
});

describe('qué liga es de torneo con grupos', () => {
  it('lo dice el servidor; si aún no lo dice, solo lo es el Mundial', () => {
    expect(isGroupTournament(true, 'uefa.euro')).toBe(true);
    expect(isGroupTournament(false, 'fifa.world')).toBe(false);
    expect(isGroupTournament(undefined, 'fifa.world')).toBe(true);
    expect(isGroupTournament(undefined, 'uefa.euro')).toBe(false);
  });

  it('una liga de otro torneo con grupos tiene las pantallas del torneo con grupos', () => {
    const league = {
      poolFormat: 'FULL_BRACKET' as const,
      formatType: 'TOURNAMENT' as const,
      competitionExternalId: 'uefa.euro',
    };
    const kind = (groupTournament: boolean) =>
      leagueKindOf({
        hasLeague: true,
        loading: false,
        error: false,
        league: { ...league, groupTournament },
      });

    expect(kind(true)).toBe('groupStage');
    expect(kind(false)).toBe('ownBracket');
  });
});
