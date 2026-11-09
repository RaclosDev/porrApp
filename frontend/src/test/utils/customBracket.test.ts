import { describe, expect, it } from 'vitest';
import {
  pairWinners,
  getCustomRoundTitle,
  getTotalRounds,
  computeCustomBracketRounds,
  computeCustomGroupTables,
  computeCustomResultRounds,
  customMatchRadar,
  customRoundMatchIndex,
  getCustomRoundShortTitle,
  nextCustomBracketMatch,
  splitCustomRounds,
  type CustomPair,
} from '../../utils/customBracket';
import type { Match } from '../../types/api';

function match(fields: Partial<Match>): Match {
  return {
    home_team_id: 1,
    away_team_id: 2,
    finished: false,
    homeScore: null,
    awayScore: null,
    winner: null,
    groupName: null,
    date: null,
    ...fields,
  } as Match;
}

describe('cuadro de competición personalizada', () => {
  it('avanza automáticamente un descanso sin elegir ganador', () => {
    expect(
      pairWinners(
        [
          ['A', 'B'],
          ['C', null],
        ],
        ['B'],
      ),
    ).toEqual(['B', 'C']);
  });

  it('no avanza una ronda con cruces sin pronosticar o ganadores ajenos', () => {
    expect(
      pairWinners(
        [
          ['A', 'B'],
          ['C', 'D'],
        ],
        ['A'],
      ),
    ).toBeNull();
    expect(pairWinners([['A', 'B']], ['C'])).toBeNull();
  });

  it('calcula el total de rondas correctamente', () => {
    expect(getTotalRounds(0)).toBe(0);
    expect(getTotalRounds(1)).toBe(1); // Final
    expect(getTotalRounds(2)).toBe(2); // Semis -> Final
    expect(getTotalRounds(4)).toBe(3); // Cuartos -> Semis -> Final
    expect(getTotalRounds(8)).toBe(4); // Octavos -> Cuartos -> Semis -> Final
  });

  it('asigna títulos descriptivos según la distancia a la final', () => {
    expect(getCustomRoundTitle(0, 3)).toBe('Cuartos de final');
    expect(getCustomRoundTitle(1, 3)).toBe('Semifinales');
    expect(getCustomRoundTitle(2, 3)).toBe('Final');

    expect(getCustomRoundTitle(0, 4)).toBe('Octavos de final');
    expect(getCustomRoundTitle(1, 4)).toBe('Cuartos de final');
    expect(getCustomRoundTitle(2, 4)).toBe('Semifinales');
    expect(getCustomRoundTitle(3, 4)).toBe('Final');

    expect(getCustomRoundTitle(0, 1)).toBe('Final');
  });

  it('computa las rondas del cuadro con placeholders iniciales para 4 cruces (8 equipos)', () => {
    const firstRound: CustomPair[] = [
      ['T1', 'Gen.G'],
      ['HLE', 'DK'],
      ['BLG', 'TES'],
      ['WBG', 'LNG'],
    ];

    const rounds = computeCustomBracketRounds(firstRound, []);
    expect(rounds).toHaveLength(3);

    // Ronda 0: Cuartos de final
    expect(rounds[0].title).toBe('Cuartos de final');
    expect(rounds[0].matches).toHaveLength(4);
    expect(rounds[0].matches[0]).toMatchObject({ home: 'T1', away: 'Gen.G' });

    // Ronda 1: Semifinales con placeholders
    expect(rounds[1].title).toBe('Semifinales');
    expect(rounds[1].matches).toHaveLength(2);
    expect(rounds[1].matches[0]).toMatchObject({
      home: null,
      away: null,
      homePlaceholder: 'Ganador cuartos 1',
      awayPlaceholder: 'Ganador cuartos 2',
    });

    // Ronda 2: Final con placeholders
    expect(rounds[2].title).toBe('Final');
    expect(rounds[2].matches).toHaveLength(1);
    expect(rounds[2].matches[0]).toMatchObject({
      home: null,
      away: null,
      homePlaceholder: 'Ganador semifinal 1',
      awayPlaceholder: 'Ganador semifinal 2',
    });
  });

  it('propaga ganadores seleccionados a las siguientes rondas', () => {
    const firstRound: CustomPair[] = [
      ['T1', 'Gen.G'],
      ['HLE', 'DK'],
      ['BLG', 'TES'],
      ['WBG', 'LNG'],
    ];

    const picks = [
      ['T1', 'DK', 'BLG', 'LNG'], // Cuartos
      ['T1', 'BLG'], // Semis
      ['T1'], // Final
    ];

    const rounds = computeCustomBracketRounds(firstRound, picks);

    // Semis
    expect(rounds[1].matches[0]).toMatchObject({ home: 'T1', away: 'DK' });
    expect(rounds[1].matches[1]).toMatchObject({ home: 'BLG', away: 'LNG' });

    // Final
    expect(rounds[2].matches[0]).toMatchObject({ home: 'T1', away: 'BLG' });
  });

  it('avanza automáticamente los byes a la siguiente ronda', () => {
    const firstRound: CustomPair[] = [
      ['T1', null],
      ['HLE', 'DK'],
    ];

    const rounds = computeCustomBracketRounds(firstRound, [[], []]);
    expect(rounds).toHaveLength(2);
    // Ronda 0 Cruce 0 es Bye
    expect(rounds[0].matches[0].isBye).toBe(true);
    // En la final, T1 ya está posicionado como local por ser bye
    expect(rounds[1].matches[0].home).toBe('T1');
    expect(rounds[1].matches[0].away).toBeNull();
  });

  it('deja sin rival al último cruce de una ronda impar en vez de esperar a un ganador inexistente', () => {
    const rounds = computeCustomBracketRounds(
      [
        ['A', 'B'],
        ['C', 'D'],
        ['E', null],
      ],
      [['A', 'D', 'E']],
    );
    expect(rounds[1].matches[1]).toMatchObject({
      home: 'E',
      away: null,
      isBye: true,
      awayPlaceholder: 'Descanso',
    });
    expect(rounds[2].matches[0]).toMatchObject({ home: null, away: 'E' });
  });
});

describe('resultados de una competición personalizada', () => {
  it('ordena cada grupo por puntos, diferencia de goles y goles a favor', () => {
    const teams = ['A', 'B', 'C'].map((name) => ({ name, groupName: 'G' }));
    const tables = computeCustomGroupTables(teams, [
      match({
        id: 1,
        round: 'group',
        groupName: 'G',
        home: 'A',
        away: 'B',
        finished: true,
        homeScore: 1,
        awayScore: 1,
      }),
      match({
        id: 2,
        round: 'group',
        groupName: 'G',
        home: 'C',
        away: 'A',
        finished: true,
        homeScore: 0,
        awayScore: 3,
      }),
      match({ id: 3, round: 'group', groupName: 'G', home: 'B', away: 'C', finished: false }),
    ]);
    expect(tables.G.map((row) => [row.team, row.points, row.played])).toEqual([
      ['A', 4, 2],
      ['B', 1, 1],
      ['C', 0, 1],
    ]);
  });

  it('muestra los cruces reales, avanza ganadores y descansos y deja huecos en rondas sin crear', () => {
    const rounds = computeCustomResultRounds([
      match({
        id: 10,
        round: 'bracket-1',
        home: 'A',
        away: 'B',
        finished: true,
        homeScore: 2,
        awayScore: 0,
        winner: 'A',
      }),
      match({ id: 11, round: 'bracket-1', home: 'C', away: 'D' }),
      match({ id: 12, round: 'bracket-1', home: 'E', away: 'Por definir', away_team_id: null }),
      match({ id: 13, round: 'group', home: 'X', away: 'Y' }),
    ]);
    expect(rounds.map((round) => round.title)).toEqual([
      'Cuartos de final',
      'Semifinales',
      'Final',
    ]);
    expect(rounds[0].slots[2]).toMatchObject({ isBye: true, awayPlaceholder: 'Descanso' });
    expect(rounds[1].slots[0]).toMatchObject({
      match: null,
      home: 'A',
      awayPlaceholder: 'Ganador cuartos 2',
    });
    expect(rounds[1].slots[1]).toMatchObject({ home: 'E', isBye: true });
    expect(rounds[2].slots[0]).toMatchObject({ home: null, away: 'E' });
  });

  it('usa los cruces que el administrador ya ha creado en rondas posteriores', () => {
    const rounds = computeCustomResultRounds([
      match({ id: 1, round: 'bracket-1', home: 'A', away: 'B', finished: true, winner: 'A' }),
      match({ id: 2, round: 'bracket-1', home: 'C', away: 'D', finished: true, winner: 'D' }),
      match({
        id: 3,
        round: 'bracket-2',
        home: 'A',
        away: 'D',
        finished: true,
        homeScore: 1,
        awayScore: 0,
        winner: 'A',
      }),
    ]);
    expect(rounds).toHaveLength(2);
    expect(rounds[1].slots[0].match?.id).toBe(3);
  });

  it('no muestra cuadro si no hay cruces de primera ronda', () => {
    expect(computeCustomResultRounds([match({ id: 1, round: 'group' })])).toEqual([]);
  });
});

describe('cuadro personalizado en el lienzo del cuadro oficial', () => {
  it('reparte cada ronda entre las mitades que acaban en cada semifinal', () => {
    // 5 cruces: 5 → 3 → 2 → 1; el quinto y su descanso van a la derecha.
    const layout = splitCustomRounds([
      ['a', 'b', 'c', 'd', 'e'],
      ['ab', 'cd', 'e'],
      ['abcd', 'e'],
      ['final'],
    ]);
    expect(layout.roundLabels).toEqual(['Octavos', 'Cuartos', 'Semis']);
    expect(layout.left).toEqual([['a', 'b', 'c', 'd'], ['ab', 'cd'], ['abcd']]);
    expect(layout.right).toEqual([['e'], ['e'], ['e']]);
    expect(layout.final).toBe('final');
    expect(customRoundMatchIndex(layout, 'right', 1, 0)).toBe(2);
    expect(customRoundMatchIndex(layout, 'left', 1, 1)).toBe(1);
  });

  it('un cuadro que empieza en la final no tiene laterales', () => {
    expect(splitCustomRounds([['final']])).toEqual({
      roundLabels: [],
      left: [],
      right: [],
      final: 'final',
    });
    expect(splitCustomRounds([])).toMatchObject({ roundLabels: [], final: null });
  });

  it('nombra las rondas como las columnas del cuadro oficial', () => {
    expect(getCustomRoundShortTitle(0, 5)).toBe('16avos');
    expect(getCustomRoundShortTitle(1, 5)).toBe('Octavos');
    expect(getCustomRoundShortTitle(3, 5)).toBe('Semis');
    expect(getCustomRoundShortTitle(4, 5)).toBe('Final');
    expect(getCustomRoundShortTitle(0, 7)).toBe('Ronda 1');
  });

  it('ordena los próximos partidos con fecha y omite los descansos', () => {
    const later = match({ id: 1, round: 'bracket-2', date: '2026-11-10T18:00:00Z' });
    const sooner = match({ id: 2, round: 'group', date: '2026-11-05T18:00:00Z' });
    const undated = match({ id: 3, round: 'bracket-1' });
    const bye = match({ id: 4, round: 'bracket-1', away_team_id: null });
    const played = match({ id: 5, round: 'bracket-1', finished: true, date: '2026-11-01' });
    const overdue = match({ id: 6, round: 'group', date: '2026-11-02T18:00:00Z' });
    const radar = customMatchRadar(
      [later, undated, bye, played, sooner, overdue],
      new Date('2026-11-03T12:00:00Z'),
    );
    // Sin fecha o con la fecha pasada no son próximos: el panel los daría por en juego.
    expect(radar.next.map((item) => item.id)).toEqual([2, 1]);
    expect(radar.last.map((item) => item.id)).toEqual([5]);
    expect(radar.live).toEqual([]);
    expect(nextCustomBracketMatch([later, undated, bye, played, sooner])?.id).toBe(1);
    expect(nextCustomBracketMatch([sooner])).toBeNull();
  });
});
