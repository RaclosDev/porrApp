import { describe, expect, it } from 'vitest';
import {
  cardSummary,
  groupCard,
  isUfcCompetition,
  leagueSplit,
  parseRecord,
  recordLabel,
} from '../../utils/fightCard';
import { matchdayFixture } from '../context/fixtures';
import type { FightInfo, MatchStats } from '../../types/api';

const fight = (overrides: Partial<FightInfo> = {}): FightInfo => ({
  eventId: '1',
  eventName: 'UFC 330',
  segment: 'MAIN',
  order: 1,
  weightClass: 'Lightweight',
  scheduledRounds: 5,
  homeRecord: '20-7-1',
  awayRecord: '12-1-0',
  resultMethod: null,
  resultDetail: null,
  resultRound: null,
  resultClock: null,
  winner: null,
  ...overrides,
});

const stats = (overrides: Partial<MatchStats> = {}): MatchStats => ({
  matchId: 1,
  round: 'UFC 330',
  matchDate: null,
  homeTeam: 'Rojo',
  awayTeam: 'Azul',
  homeTeamLogo: null,
  awayTeamLogo: null,
  finished: false,
  live: true,
  homeScore: null,
  awayScore: null,
  predictions: 4,
  homeWins: 3,
  draws: 0,
  awayWins: 1,
  topScores: [],
  exactHits: null,
  signHits: null,
  methods: [],
  ...overrides,
});

describe('isUfcCompetition', () => {
  it('reconoce la UFC por su id de ESPN y nada más', () => {
    expect(isUfcCompetition('mma.ufc')).toBe(true);
    expect(isUfcCompetition(' MMA.UFC ')).toBe(true);
    expect(isUfcCompetition('nba')).toBe(false);
    expect(isUfcCompetition(null)).toBe(false);
  });
});

describe('groupCard', () => {
  it('ordena los bloques como se anuncian y cada bloque por su orden en la cartelera', () => {
    const fixtures = [
      matchdayFixture({ matchId: 1, fight: fight({ segment: 'EARLY_PRELIMS', order: 12 }) }),
      matchdayFixture({ matchId: 2, fight: fight({ segment: 'MAIN', order: 2 }) }),
      matchdayFixture({ matchId: 3, fight: fight({ segment: 'PRELIMS', order: 7 }) }),
      matchdayFixture({ matchId: 4, fight: fight({ segment: 'MAIN', order: 1 }) }),
      matchdayFixture({ matchId: 5, fight: fight({ segment: null, order: 6 }) }),
      matchdayFixture({ matchId: 6, fight: null }),
    ];

    const segments = groupCard(fixtures);

    expect(segments.map((s) => s.segment)).toEqual(['MAIN', 'PRELIMS', 'EARLY_PRELIMS']);
    expect(segments[0].fights.map((f) => f.matchId)).toEqual([4, 2]);
    // Sin bloque cuenta como preliminar; sin datos de pelea no sale.
    expect(segments[1].fights.map((f) => f.matchId)).toEqual([5, 3]);
    expect(segments.flatMap((s) => s.fights).some((f) => f.matchId === 6)).toBe(false);
  });
});

describe('récords', () => {
  it('lee victorias, derrotas y empates', () => {
    expect(parseRecord('27-1-0')).toEqual({ wins: 27, losses: 1, draws: 0 });
    expect(parseRecord('12-1-0 (1 NC)')).toEqual({ wins: 12, losses: 1, draws: 0 });
    expect(parseRecord('')).toBeNull();
    expect(recordLabel('1-1-2')).toBe('1 victoria, 1 derrota y 2 empates');
    expect(recordLabel('raro')).toBe('raro');
  });
});

describe('leagueSplit', () => {
  it('reparte la liga entre los dos luchadores y saca el método favorito', () => {
    const split = leagueSplit(
      stats({
        homeWins: 2,
        awayWins: 1,
        methods: [
          { method: 'KO_TKO', count: 2 },
          { method: 'DECISION', count: 1 },
        ],
      }),
    );

    expect(split).toMatchObject({ total: 3, red: 2, blue: 1, redPercent: 67, bluePercent: 33 });
    expect(split?.topMethod).toEqual({ label: 'KO/TKO', percent: 67 });
  });

  it('sin estadísticas no hay reparto, y sin métodos no hay favorito', () => {
    expect(leagueSplit(undefined)).toBeNull();
    const split = leagueSplit(stats({ homeWins: 0, awayWins: 0, methods: undefined }));
    expect(split).toMatchObject({ total: 0, redPercent: 0, bluePercent: 0, topMethod: null });
  });
});

describe('cardSummary', () => {
  it('cuenta peleas, terminadas, aciertos y puntos sin las canceladas', () => {
    const summary = cardSummary([
      matchdayFixture({
        matchId: 1,
        finished: true,
        predSign: '1',
        pointsAwarded: 5,
        fight: fight({ winner: '1' }),
      }),
      matchdayFixture({
        matchId: 2,
        finished: true,
        predSign: '1',
        pointsAwarded: 0,
        fight: fight({ winner: '2' }),
      }),
      matchdayFixture({ matchId: 3, finished: true, fight: fight({ winner: '2' }) }),
      matchdayFixture({ matchId: 4, predSign: '2', fight: fight() }),
      matchdayFixture({ matchId: 5, status: 'CANCELLED', predSign: '1', fight: fight() }),
    ]);

    expect(summary).toEqual({ fights: 4, finished: 3, hits: 1, predicted: 2, points: 5 });
  });
});
