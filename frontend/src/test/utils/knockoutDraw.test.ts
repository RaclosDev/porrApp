import { describe, expect, it } from 'vitest';
import type { KnockoutRound } from '../../services/api';
import type { Competition, Match } from '../../types/api';
import {
  defaultKnockoutRound,
  knockoutPrediction,
  knockoutRoundTitle,
  picksFromSaved,
  tieAggregate,
} from '../../utils/knockoutDraw';
import {
  emptyDraft,
  formatCopy,
  formatUnavailableReason,
  lockModesFor,
  normalizeDraft,
  pichichiApplies,
  type LeagueDraft,
} from '../../components/createLeague/leagueDraft';
import { scoringSections } from '../../utils/scoringRules';

const tie = (home: string, away: string, winner: string | null = null, matchIds = [1, 2]) => ({
  home,
  away,
  winner,
  matchIds,
});

const rounds: KnockoutRound[] = [
  {
    round: 'playoff',
    drawn: true,
    expectedTies: 2,
    ties: [
      tie('Galatasaray', 'Juventus', 'Galatasaray'),
      tie('Benfica', 'Real Madrid', null, [3, 4]),
    ],
  },
  { round: 'r16', drawn: false, expectedTies: 8, ties: [] },
  { round: 'final', drawn: false, expectedTies: 1, ties: [] },
];

const match = (id: number, home: string, away: string, homeScore: number, awayScore: number) =>
  ({ id, home, away, homeScore, awayScore, finished: true, status: 'FINISHED' }) as Match;

describe('eliminatorias sorteadas ronda a ronda', () => {
  it('nombra las rondas', () => {
    expect(knockoutRoundTitle('playoff')).toBe('Playoff');
    expect(knockoutRoundTitle('r16')).toBe('Octavos');
    expect(knockoutRoundTitle('otra')).toBe('otra');
  });

  it('alinea lo guardado con los cruces y descarta equipos que ya no juegan ese cruce', () => {
    expect(picksFromSaved(rounds, [['Juventus', 'Barcelona']])).toEqual([
      ['Juventus', null],
      [],
      [],
    ]);
  });

  it('guarda una lista por ronda, sin rondas vacías al final, y sin campeón hasta la final', () => {
    const data = knockoutPrediction(rounds, [[null, 'Benfica'], [], []], 'Ana', '');
    expect(data?.customRounds).toEqual([[null, 'Benfica']]);
    expect(data?.champion).toBeNull();
    expect(data?.prediction).toBe('Ana');
    expect(knockoutPrediction(rounds, [[null, null]], 'Ana', '')).toBeNull();
  });

  it('el campeón es el elegido en la final', () => {
    const final: KnockoutRound[] = [
      { round: 'final', drawn: true, expectedTies: 1, ties: [tie('PSG', 'Arsenal')] },
    ];
    expect(knockoutPrediction(final, [['Arsenal']], 'Ana', 'Mi porra')?.champion).toBe('Arsenal');
  });

  it('suma el global de ida y vuelta desde el lado de cada equipo', () => {
    const matches = new Map([
      [1, match(1, 'Galatasaray', 'Juventus', 5, 2)],
      [2, match(2, 'Juventus', 'Galatasaray', 3, 2)],
    ]);
    expect(tieAggregate(rounds[0].ties[0], matches)).toEqual({ home: 7, away: 5 });
    expect(tieAggregate(rounds[0].ties[1], matches)).toBeNull();
  });

  it('abre la primera ronda sorteada con cruces por decidir', () => {
    expect(defaultKnockoutRound(rounds)).toBe(0);
    const done = rounds.map((round) => ({
      ...round,
      ties: round.ties.map((item) => ({ ...item, winner: item.home })),
    }));
    expect(defaultKnockoutRound(done)).toBe(0);
  });
});

describe('crear una liga de eliminatorias de la Champions', () => {
  const champions: Competition = {
    id: 5,
    name: 'UEFA Champions League',
    externalId: 'uefa.champions',
    formatType: 'LEAGUE',
    knockoutDraw: true,
  };
  const ctx = { competitions: [champions] };
  const draft = (patch: Partial<LeagueDraft>) =>
    normalizeDraft({ ...emptyDraft(), sport: 'FOOTBALL', competitionId: 5, ...patch }, ctx);

  it('admite solo eliminatorias aunque la competición sea de liga, pero no el cuadro completo', () => {
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', draft({}), ctx)).toBeNull();
    expect(formatUnavailableReason('FULL_BRACKET', draft({}), ctx)).toMatch(/ronda a ronda/);
    expect(formatCopy('KNOCKOUTS_ONLY', draft({}), ctx).text).toMatch(/quién pasa/);
  });

  it('se cierra por rondas o por eliminatorias, sin pichichi', () => {
    const knockouts = draft({ poolFormat: 'KNOCKOUTS_ONLY' });
    expect(lockModesFor(knockouts, ctx).map((mode) => mode.value)).toEqual([
      'PER_ROUND',
      'PER_MATCH',
    ]);
    expect(knockouts.lockMode).toBe('PER_ROUND');
    expect(pichichiApplies(knockouts, ctx)).toBe(false);
  });

  it('puntúa cada cruce acertado por ronda', () => {
    const [section] = scoringSections('KNOCKOUTS_ONLY', false, true);
    expect(section.fields.map((field) => field.key)).toEqual([
      'roundOf32Points',
      'roundOf16Points',
      'quarterFinalPoints',
      'semiFinalPoints',
      'championPoints',
    ]);
  });
});
