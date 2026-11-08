import { describe, expect, it } from 'vitest';
import type { KnockoutRound } from '../../services/api';
import type { Competition, Match } from '../../types/api';
import { gamesFromSaved, knockoutPrediction, knockoutRoundTitle } from '../../utils/knockoutDraw';
import { isNbaCompetition, seriesLengths, seriesScore, seriesWins } from '../../utils/nbaPlayoffs';
import {
  emptyDraft,
  formatCopy,
  formatUnavailableReason,
  lockModesFor,
  normalizeDraft,
  sportChoices,
  SPORT_LABELS,
  type LeagueDraft,
} from '../../components/createLeague/leagueDraft';

const tie = (home: string, away: string, matchIds: number[], winner: string | null = null) => ({
  home,
  away,
  winner,
  matchIds,
  conference: 'W',
});

const rounds: KnockoutRound[] = [
  {
    round: 'playin',
    drawn: true,
    expectedTies: 6,
    bestOf: 1,
    ties: [tie('Warriors', 'Grizzlies', [1])],
  },
  {
    round: 'r16',
    drawn: true,
    expectedTies: 8,
    bestOf: 7,
    ties: [
      tie('Thunder', 'Grizzlies', [2, 3, 4, 5], 'Thunder'),
      tie('Nuggets', 'Clippers', [6, 7]),
    ],
  },
  { round: 'final', drawn: false, expectedTies: 1, bestOf: 7, ties: [] },
];

const game = (id: number, home: string, away: string, homeScore: number, awayScore: number) =>
  ({ id, home, away, homeScore, awayScore, finished: true, status: 'FINISHED' }) as Match;

describe('playoffs de la NBA', () => {
  it('reconoce la NBA y nombra sus rondas, cortas para las pestañas', () => {
    expect(isNbaCompetition('nba')).toBe(true);
    expect(isNbaCompetition('esp.1')).toBe(false);
    expect(knockoutRoundTitle('r16', true)).toBe('Primera ronda');
    expect(knockoutRoundTitle('qf', true, true)).toBe('Semis conf.');
    expect(knockoutRoundTitle('r16')).toBe('Octavos');
  });

  it('cuenta las victorias de cada equipo en la serie, juegue en casa o fuera', () => {
    const matches = new Map(
      [
        game(2, 'Thunder', 'Grizzlies', 131, 80),
        game(3, 'Thunder', 'Grizzlies', 118, 104),
        game(4, 'Grizzlies', 'Thunder', 108, 114),
        game(5, 'Grizzlies', 'Thunder', 115, 117),
      ].map((match) => [match.id, match]),
    );
    expect(seriesWins(rounds[1].ties[0], matches)).toEqual({ home: 4, away: 0, played: 4 });
    expect(seriesWins(rounds[1].ties[1], matches)).toEqual({ home: 0, away: 0, played: 0 });
  });

  it('una serie al mejor de 7 se gana en 4 a 7 partidos', () => {
    expect(seriesLengths(7)).toEqual([4, 5, 6, 7]);
    expect(seriesScore(4, 7)).toBe('4-0');
    expect(seriesScore(7, 7)).toBe('4-3');
  });

  it('guarda en cuántos partidos solo donde hay ganador elegido y la serie es a más de uno', () => {
    const picks = [['Warriors'], ['Thunder', null], []];
    expect(gamesFromSaved(rounds, picks, [[4], [5, 6]])).toEqual([[null], [5, null], []]);
    expect(gamesFromSaved(rounds, picks, [[], [9]])).toEqual([[null], [null, null], []]);

    const data = knockoutPrediction(rounds, picks, 'Ana', '', [[null], [5, null], []]);
    expect(data?.customRounds).toEqual([['Warriors'], ['Thunder', null]]);
    expect(data?.customSeriesGames).toEqual([[null], [5, null]]);
    // Sin partidos elegidos no se manda la lista.
    expect(knockoutPrediction(rounds, picks, 'Ana', '')?.customSeriesGames).toBeUndefined();
  });
});

describe('crear una liga de la NBA', () => {
  const nba: Competition = {
    id: 30,
    name: 'NBA',
    externalId: 'nba',
    formatType: 'TOURNAMENT',
    sport: 'BASKETBALL',
    finished: false,
    groupStage: false,
    knockoutDraw: true,
  };
  const laliga: Competition = {
    id: 1,
    name: 'LaLiga EA Sports',
    externalId: 'esp.1',
    formatType: 'LEAGUE',
    sport: 'FOOTBALL',
  };
  const ctx = { competitions: [laliga, nba] };
  const draft = (fields: Partial<LeagueDraft>) => ({ ...emptyDraft(), ...fields });

  it('ofrece el baloncesto como deporte', () => {
    expect(sportChoices(ctx)).toEqual(['FOOTBALL', 'BASKETBALL', 'OTHER']);
    expect(SPORT_LABELS.BASKETBALL).toBe('Baloncesto');
  });

  it('solo admite el modo Playoffs, cerrado serie a serie por defecto', () => {
    const chosen = draft({ sport: 'BASKETBALL', competitionId: 30 });
    expect(formatUnavailableReason('MATCH_DAY', chosen, ctx)).toMatch(/playoffs/);
    expect(formatUnavailableReason('SURVIVOR', chosen, ctx)).toMatch(/playoffs/);
    expect(formatUnavailableReason('FULL_BRACKET', chosen, ctx)).toMatch(/playoffs/);
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', chosen, ctx)).toBeNull();
    expect(formatCopy('KNOCKOUTS_ONLY', chosen, ctx).title).toBe('Playoffs');

    const normalized = normalizeDraft({ ...chosen, poolFormat: 'KNOCKOUTS_ONLY' }, ctx);
    expect(normalized.lockMode).toBe('PER_MATCH');
    expect(lockModesFor(normalized, ctx).map((mode) => mode.label)).toEqual([
      'Por series',
      'Por rondas',
    ]);
    // Un modo de fútbol que ya no aplica se quita.
    expect(normalizeDraft({ ...chosen, poolFormat: 'MATCH_DAY' }, ctx).poolFormat).toBeNull();
  });
});
