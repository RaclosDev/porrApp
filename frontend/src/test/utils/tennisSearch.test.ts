import { describe, expect, it } from 'vitest';
import type { MatchStats, MatchVoters } from '../../types/api';
import {
  favouritePlayers,
  matchPickers,
  playerLogos,
  playerMatches,
  playerSituation,
  searchablePlayers,
} from '../../utils/tennisSearch';

const match = (over: Partial<MatchStats> & Pick<MatchStats, 'matchId'>): MatchStats => ({
  round: 'Semifinales',
  matchDate: '2026-11-07T18:00:00Z',
  homeTeam: 'Alcaraz',
  awayTeam: 'Sinner',
  homeTeamLogo: null,
  awayTeamLogo: null,
  finished: false,
  live: false,
  homeScore: null,
  awayScore: null,
  predictions: 0,
  homeWins: 0,
  draws: 0,
  awayWins: 0,
  topScores: [],
  exactHits: null,
  signHits: null,
  ...over,
});

/** Cuartos y semifinales jugados; la final, empezada y sin marcador. */
const draw = [
  match({
    matchId: 1,
    round: 'Cuartos de final',
    homeTeam: 'Alcaraz',
    awayTeam: 'Zverev',
    homeTeamLogo: 'alcaraz.png',
    finished: true,
    homeScore: 2,
    awayScore: 0,
    homeWins: 5,
    awayWins: 1,
  }),
  match({
    matchId: 2,
    round: 'Cuartos de final',
    homeTeam: 'Medvedev',
    awayTeam: 'Sinner',
    finished: true,
    homeScore: 1,
    awayScore: 2,
    homeWins: 2,
    awayWins: 4,
  }),
  match({
    matchId: 3,
    homeTeam: 'Alcaraz',
    awayTeam: 'Por definir',
    homeWins: 3,
    awayWins: 0,
  }),
  match({
    matchId: 4,
    round: 'Final',
    homeTeam: 'Sinner',
    awayTeam: 'Alcaraz',
    live: true,
    homeWins: 2,
    awayWins: 3,
  }),
];

describe('jugadores que se pueden buscar', () => {
  it('salen los de los partidos visibles, sin los huecos por definir', () => {
    expect(searchablePlayers(draw)).toEqual(['Alcaraz', 'Medvedev', 'Sinner', 'Zverev']);
  });

  it('los favoritos son los que más veces da ganador la liga', () => {
    expect(favouritePlayers(draw, 3)).toEqual(['Alcaraz', 'Sinner', 'Medvedev']);
    expect(favouritePlayers(draw, 1)).toEqual(['Alcaraz']);
  });

  it('cada jugador lleva la foto que traiga alguno de sus partidos', () => {
    const logos = playerLogos(draw);
    expect(logos.Alcaraz).toBe('alcaraz.png');
    expect(logos.Sinner).toBeNull();
  });
});

describe('partidos de un jugador', () => {
  it('cuenta quién lo da ganador en cada partido y lo compara con el resultado', () => {
    const rows = playerMatches(draw, 'Sinner');

    expect(rows.map((row) => row.matchId)).toEqual([2, 4]);
    expect(rows[0]).toMatchObject({
      side: 'away',
      rival: 'Medvedev',
      round: 'Cuartos de final',
      tournament: null,
      count: 4,
      total: 6,
      percent: 67,
      status: 'yes',
      score: '2-1',
    });
    // La final ha empezado pero no tiene marcador: aún no se sabe.
    expect(rows[1]).toMatchObject({ side: 'home', rival: 'Alcaraz', count: 2, total: 5 });
    expect(rows[1].status).toBe('pending');
    expect(rows[1].score).toBeNull();
  });

  it('marca la derrota y no divide por cero si nadie eligió ganador', () => {
    const rows = playerMatches(
      [...draw, match({ matchId: 9, homeTeam: 'Zverev', awayTeam: 'Rune' })],
      'Zverev',
    );

    expect(rows[0]).toMatchObject({ status: 'no', score: '0-2', count: 1, total: 6 });
    expect(rows[1]).toMatchObject({ rival: 'Rune', count: 0, total: 0, percent: 0 });
  });

  it('en una liga de varios torneos separa el torneo de la ronda', () => {
    const [row] = playerMatches(
      [match({ matchId: 7, round: 'Roland Garros 2027 · Octavos de final' })],
      'Alcaraz',
    );

    expect(row.tournament).toBe('Roland Garros 2027');
    expect(row.round).toBe('Octavos de final');
  });

  it('no es de un jugador que no juega', () => {
    expect(playerMatches(draw, 'Rune')).toEqual([]);
  });
});

describe('situación del jugador', () => {
  const finalWith = (homeScore: number, awayScore: number) => [
    ...draw.slice(0, 3),
    match({
      matchId: 4,
      round: 'Final',
      homeTeam: 'Sinner',
      awayTeam: 'Alcaraz',
      finished: true,
      homeScore,
      awayScore,
    }),
  ];

  it('dice dónde cayó o si fue campeón, y calla mientras sigue en juego', () => {
    expect(playerSituation(playerMatches(draw, 'Zverev'))).toBe('Cayó en cuartos de final');
    expect(playerSituation(playerMatches(draw, 'Sinner'))).toBeNull();
    expect(playerSituation(playerMatches(draw.slice(0, 2), 'Sinner'))).toBeNull();
    expect(playerSituation([])).toBeNull();

    const played = finalWith(2, 1);
    expect(playerSituation(playerMatches(played, 'Sinner'))).toBe('Campeón');
    expect(playerSituation(playerMatches(played, 'Alcaraz'))).toBe('Subcampeón');
  });

  it('perder en la fase de grupos no elimina', () => {
    const group = [
      match({
        matchId: 1,
        round: 'Fase de grupos',
        finished: true,
        homeScore: 0,
        awayScore: 2,
      }),
    ];
    expect(playerSituation(playerMatches(group, 'Alcaraz'))).toBeNull();
  });
});

describe('quién pone a un jugador en un partido', () => {
  const voter = (userId: number, name: string) => ({ userId, name, avatarUrl: null });
  const voters: MatchVoters = {
    matchId: 4,
    home: [voter(2, 'Berto'), voter(1, 'Ana')],
    draw: [],
    away: [voter(3, 'Carla')],
  };

  it('separa a los que lo dan ganador de los que ponen al rival, por nombre', () => {
    const local = matchPickers(voters, 'home');
    expect(local.yes.map((v) => v.name)).toEqual(['Ana', 'Berto']);
    expect(local.no.map((v) => v.name)).toEqual(['Carla']);

    const visitor = matchPickers(voters, 'away');
    expect(visitor.yes.map((v) => v.name)).toEqual(['Carla']);
    expect(visitor.no.map((v) => v.name)).toEqual(['Ana', 'Berto']);
  });

  it('sin votantes cargados no enseña a nadie', () => {
    expect(matchPickers(undefined, 'home')).toEqual({ yes: [], no: [] });
  });
});
