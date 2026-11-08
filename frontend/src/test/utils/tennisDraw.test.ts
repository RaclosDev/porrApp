import { describe, expect, it } from 'vitest';
import {
  actualWinner,
  groupStage,
  isTennisCompetition,
  knockoutRounds,
  predictedWinner,
  qualifiedKeys,
  sideState,
  tennisDraws,
} from '../../utils/tennisDraw';
import { matchdayFixture } from '../context/fixtures';
import type { MatchdayFixture } from '../../types/api';

let nextId = 1;
const match = (
  round: string,
  home: string,
  away: string,
  fields: Partial<MatchdayFixture> = {},
): MatchdayFixture =>
  matchdayFixture({
    matchId: nextId++,
    round,
    homeTeam: home,
    awayTeam: away,
    matchDate: new Date(Date.UTC(2026, 10, 1) + nextId * 3_600_000).toISOString(),
    ...fields,
  });

const won = (sets: [number, number]): Partial<MatchdayFixture> => ({
  finished: true,
  status: 'FINISHED',
  actualHomeScore: sets[0],
  actualAwayScore: sets[1],
  winnerSign: sets[0] > sets[1] ? '1' : '2',
});

describe('isTennisCompetition', () => {
  it('reconoce los cuadros ATP y WTA del catálogo', () => {
    expect(isTennisCompetition('tennis.atp.339')).toBe(true);
    expect(isTennisCompetition(' TENNIS.wta.189 ')).toBe(true);
    expect(isTennisCompetition('mma.ufc')).toBe(false);
    expect(isTennisCompetition(null)).toBe(false);
  });
});

describe('ganador', () => {
  it('el real admite una retirada sin marcador y el predicho sale del marcador de sets', () => {
    const retired = match('Final', 'A', 'B', { finished: true, winnerSign: '2' });
    expect(actualWinner(retired)).toBe('2');
    expect(actualWinner(match('Final', 'A', 'B'))).toBeNull();
    expect(predictedWinner(match('Final', 'A', 'B', { predHomeScore: 2, predAwayScore: 1 }))).toBe(
      '1',
    );
    expect(predictedWinner(match('Final', 'A', 'B'))).toBeNull();
  });
});

describe('knockoutRounds', () => {
  it('coloca cada partido debajo del que juega su ganador, aunque ESPN los dé desordenados', () => {
    // Cuartos en el orden de ESPN, que no es el del cuadro.
    const qf = [
      match('Cuartos de final', 'Fritz', 'Draper', won([2, 0])),
      match('Cuartos de final', 'Sinner', 'Musetti', won([2, 1])),
      match('Cuartos de final', 'Zverev', 'Rune', won([0, 2])),
      match('Cuartos de final', 'Alcaraz', 'Ruud', won([2, 0])),
    ];
    const sf = [
      match('Semifinales', 'Alcaraz', 'Fritz', won([2, 1])),
      match('Semifinales', 'Rune', 'Sinner', won([0, 2])),
    ];
    const final = match('Final', 'Sinner', 'Alcaraz');
    const rounds = knockoutRounds([...qf, ...sf, final], 'results');

    expect(rounds.map((r) => r.label)).toEqual(['Cuartos de final', 'Semifinales', 'Final']);
    const names = (i: number) =>
      rounds[i].slots.map((s) => `${s.fixture?.homeTeam}-${s.fixture?.awayTeam}`);
    expect(names(1)).toEqual(['Rune-Sinner', 'Alcaraz-Fritz']);
    expect(names(0)).toEqual(['Zverev-Rune', 'Sinner-Musetti', 'Alcaraz-Ruud', 'Fritz-Draper']);
  });

  it('enseña los huecos de las rondas que faltan hasta la final', () => {
    const r16 = Array.from({ length: 8 }, (_, i) =>
      match('Octavos de final', `L${i}`, `V${i}`, { predHomeScore: 2, predAwayScore: 0 }),
    );
    const rounds = knockoutRounds(r16, 'results');
    expect(rounds.map((r) => r.slots.length)).toEqual([8, 4, 2, 1]);
    expect(rounds[1].slots.every((s) => s.fixture == null && !s.projected)).toBe(true);

    // Con las predicciones, los cuartos vacíos enseñan a quién ha dado el usuario como ganador.
    const predicted = knockoutRounds(r16, 'predictions');
    expect(predicted[1].slots[0].projected).toEqual({ home: 'L0', away: 'L1' });
    expect(predicted[2].slots[0].projected).toBeUndefined();
  });

  it('sin rondas eliminatorias no hay cuadro', () => {
    expect(knockoutRounds([match('Fase de grupos', 'A', 'B')], 'results')).toEqual([]);
  });
});

describe('groupStage', () => {
  // Las ATP Finals 2025: dos grupos de cuatro, sin que ESPN diga cuál es cuál.
  const group = [
    match('Fase de grupos', 'Alcaraz', 'De Minaur', won([2, 0])),
    match('Fase de grupos', 'Zverev', 'Shelton', won([2, 0])),
    match('Fase de grupos', 'Fritz', 'Musetti', won([2, 0])),
    match('Fase de grupos', 'Sinner', 'Auger-Aliassime', won([2, 0])),
  ];
  const third = [
    match('Fase de grupos', 'Alcaraz', 'Fritz', won([2, 1])),
    match('Fase de grupos', 'Musetti', 'De Minaur', won([2, 1])),
    match('Fase de grupos', 'Auger-Aliassime', 'Shelton', won([2, 1])),
    match('Fase de grupos', 'Sinner', 'Zverev', won([2, 0])),
  ];

  it('mientras no se cruzan los rivales de cada grupo, una sola tabla', () => {
    const groups = groupStage(group, 'results');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Fase de grupos');
    expect(groups[0].rows).toHaveLength(8);
  });

  it('separa los dos grupos y los ordena por victorias y sets', () => {
    const groups = groupStage([...group, ...third], 'results');
    expect(groups.map((g) => g.name)).toEqual(['Grupo A', 'Grupo B']);
    expect(groups[0].rows.map((r) => r.name)).toEqual(['Alcaraz', 'Fritz', 'Musetti', 'De Minaur']);
    expect(groups[0].rows[0]).toMatchObject({
      played: 2,
      won: 2,
      lost: 0,
      setsWon: 4,
      setsLost: 1,
    });
    expect(groups[1].rows[0].name).toBe('Sinner');
    expect(groups[0].complete).toBe(true);
  });

  it('pasan los que ya están en semifinales; con las predicciones, los dos primeros del grupo acabado', () => {
    const [a] = groupStage([...group, ...third], 'results');
    const semis = [match('Semifinales', 'Alcaraz', 'Auger-Aliassime')];
    expect([...qualifiedKeys(a, semis, 'results')]).toEqual(['name:Alcaraz']);

    const predicted = [...group, ...third].map((f) => ({
      ...f,
      predHomeScore: 0,
      predAwayScore: 2,
    }));
    const [pa] = groupStage(predicted, 'predictions');
    expect(pa.complete).toBe(true);
    expect(qualifiedKeys(pa, semis, 'predictions').size).toBe(2);
  });

  it('dos empatados a victorias los desempata su duelo', () => {
    const fixtures = [
      match('Fase de grupos', 'A', 'B', won([2, 1])),
      match('Fase de grupos', 'B', 'C', won([2, 0])),
      match('Fase de grupos', 'D', 'A', won([2, 0])),
      match('Fase de grupos', 'D', 'C', won([2, 0])),
    ];
    // A y B, una victoria cada uno; B tiene mejor porcentaje de sets, pero A le ganó.
    const rows = groupStage(fixtures, 'results')[0].rows.map((r) => r.name);
    expect(rows.indexOf('A')).toBeLessThan(rows.indexOf('B'));
  });
});

describe('tennisDraws', () => {
  it('un cuadro por competición de la liga y ninguno sin partidos', () => {
    const fixtures = [
      match('Final', 'A', 'B', { competitionName: 'US Open · masculino' }),
      match('Final', 'C', 'D', { competitionName: 'US Open · femenino' }),
    ];
    expect(tennisDraws(fixtures, 'results').map((d) => d.name)).toEqual([
      'US Open · masculino',
      'US Open · femenino',
    ]);
    expect(tennisDraws([], 'results')).toEqual([]);
  });

  it('en una liga de varios torneos, un cuadro por torneo, año y cuadro, con sus rondas', () => {
    const fixtures = [
      match('Roland Garros 2027 · Final', 'A', 'B', {
        competitionName: 'Roland Garros · masculino',
      }),
      match('Roland Garros 2027 · Final', 'C', 'D', {
        competitionName: 'Roland Garros · femenino',
      }),
      match('Masters de París 2027 · Fase de grupos', 'E', 'F', {
        competitionName: 'Masters de París',
      }),
      match('Masters de París 2027 · Final', 'E', 'F', { competitionName: 'Masters de París' }),
      match('Roland Garros 2028 · Final', 'A', 'C', {
        competitionName: 'Roland Garros · masculino',
      }),
    ];
    const draws = tennisDraws(fixtures, 'results');
    expect(draws.map((d) => d.name)).toEqual([
      'Roland Garros 2027 · masculino',
      'Roland Garros 2027 · femenino',
      'Masters de París 2027',
      'Roland Garros 2028 · masculino',
    ]);
    expect(draws[0].rounds.map((r) => r.label)).toEqual(['Final']);
    expect(draws[2].groups).toHaveLength(1);
  });
});

describe('sideState', () => {
  it('con resultados pasa el ganador; con predicciones, el elegido y si se acertó', () => {
    const fixture = match('Final', 'A', 'B', {
      ...won([2, 1]),
      predHomeScore: 0,
      predAwayScore: 2,
    });
    expect(sideState(fixture, 'home', 'results')).toEqual({
      advances: true,
      out: false,
      outcome: null,
    });
    expect(sideState(fixture, 'away', 'results').out).toBe(true);
    expect(sideState(fixture, 'away', 'predictions')).toEqual({
      advances: true,
      out: false,
      outcome: 'miss',
    });
    expect(sideState(fixture, 'home', 'predictions').outcome).toBeNull();
  });
});
