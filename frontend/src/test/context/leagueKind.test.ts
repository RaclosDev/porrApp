import { describe, expect, it } from 'vitest';
import {
  BRACKET_KINDS,
  LEAGUE_KINDS,
  MATCH_KINDS,
  leagueKindOf,
  type LeagueFacts,
  type LeagueKind,
  type LeagueKindInput,
} from '../../context/leagueKind';

const ready = (league: LeagueFacts): LeagueKindInput => ({
  hasLeague: true,
  loading: false,
  error: false,
  league,
});

/** Una liga real de cada clase. */
const EXAMPLES: Record<LeagueKind, LeagueKindInput> = {
  loading: { hasLeague: true, loading: true, error: false, league: undefined },
  error: { hasLeague: true, loading: false, error: true, league: undefined },
  none: { hasLeague: false, loading: false, error: false, league: undefined },
  groupStage: ready({
    poolFormat: 'FULL_BRACKET',
    formatType: 'TOURNAMENT',
    competitionExternalId: 'fifa.world',
    groupTournament: true,
  }),
  customBracket: ready({ poolFormat: 'FULL_BRACKET', customCompetition: true, formatType: null }),
  ownBracket: ready({
    poolFormat: 'FULL_BRACKET',
    formatType: 'TOURNAMENT',
    competitionExternalId: 'lol.worlds',
  }),
  knockoutDraw: ready({
    poolFormat: 'KNOCKOUTS_ONLY',
    formatType: 'TOURNAMENT',
    competitionExternalId: 'uefa.champions',
    knockoutDraw: true,
  }),
  matchday: ready({
    poolFormat: 'MATCH_DAY',
    formatType: 'LEAGUE',
    competitionExternalId: 'esp.1',
  }),
  fightCard: ready({
    poolFormat: 'MATCH_DAY',
    formatType: 'EVENTS',
    competitionExternalId: 'mma.ufc',
  }),
  tennisDraw: ready({
    poolFormat: 'MATCH_DAY',
    formatType: 'TOURNAMENT',
    competitionExternalId: 'tennis.atp.1',
  }),
  grandPrix: ready({ poolFormat: 'GRAND_PRIX', formatType: 'RACE', competitionExternalId: 'f1' }),
  // Liga de juegos de mesa: el servidor le pone un formato, pero manda la clase.
  scoreboard: ready({ poolFormat: 'MATCH_DAY', kind: 'SCOREBOARD' }),
  tournament: ready({ poolFormat: 'MATCH_DAY', kind: 'TOURNAMENT' }),
  unknown: ready({
    poolFormat: null,
    formatType: 'TOURNAMENT',
    competitionExternalId: 'fifa.world',
  }),
};

describe('leagueKindOf', () => {
  it.each(LEAGUE_KINDS)('reconoce una liga %s', (kind) => {
    expect(leagueKindOf(EXAMPLES[kind])).toBe(kind);
  });

  it.each<[string, LeagueFacts, LeagueKind]>([
    [
      'el Mundial por jornadas',
      { poolFormat: 'MATCH_DAY', competitionExternalId: 'fifa.world' },
      'matchday',
    ],
    ['el superviviente', { poolFormat: 'SURVIVOR', formatType: 'LEAGUE' }, 'matchday'],
    [
      'el cuadro femenino de un torneo de tenis',
      {
        poolFormat: 'MATCH_DAY',
        formatType: 'TOURNAMENT',
        competitionExternalId: 'tennis.wta.189',
      },
      'tennisDraw',
    ],
    [
      'una liga de varias competiciones',
      { poolFormat: 'MATCH_DAY', formatType: 'LEAGUE', multiCompetition: true },
      'matchday',
    ],
    [
      'los playoffs de la NBA',
      {
        poolFormat: 'KNOCKOUTS_ONLY',
        formatType: 'TOURNAMENT',
        competitionExternalId: 'nba',
        knockoutDraw: true,
      },
      'knockoutDraw',
    ],
    [
      'el cuadro del Mundial solo de eliminatorias',
      {
        poolFormat: 'KNOCKOUTS_ONLY',
        formatType: 'TOURNAMENT',
        competitionExternalId: 'fifa.world',
        groupTournament: true,
      },
      'groupStage',
    ],
    [
      'una personalizada por jornadas',
      { poolFormat: 'MATCH_DAY', customCompetition: true },
      'matchday',
    ],
    // Lo que no encaja no se trata como ninguna otra clase, y menos como el Mundial.
    [
      'un cuadro de varias competiciones',
      { poolFormat: 'FULL_BRACKET', multiCompetition: true, competitionExternalId: 'fifa.world' },
      'unknown',
    ],
    [
      'un cuadro sin competición',
      { poolFormat: 'FULL_BRACKET', formatType: 'TOURNAMENT' },
      'unknown',
    ],
    [
      'un cuadro de una liga regular',
      { poolFormat: 'FULL_BRACKET', formatType: 'LEAGUE', competitionExternalId: 'esp.1' },
      'unknown',
    ],
    [
      'un formato que la app no conoce',
      { poolFormat: 'BINGO' as never, formatType: 'TOURNAMENT' },
      'unknown',
    ],
  ])('%s', (_name, league, kind) => {
    expect(leagueKindOf(ready(league))).toBe(kind);
  });

  it('sin liga no hay clase, aunque queden datos de la anterior', () => {
    expect(leagueKindOf({ ...EXAMPLES.groupStage, hasLeague: false })).toBe('none');
  });

  it('un error manda sobre lo que quedara en caché', () => {
    expect(leagueKindOf({ ...EXAMPLES.groupStage, error: true })).toBe('error');
  });

  it('ninguna clase es a la vez de cuadro y de partidos', () => {
    for (const kind of LEAGUE_KINDS) expect(BRACKET_KINDS[kind] && MATCH_KINDS[kind]).toBe(false);
  });
});
