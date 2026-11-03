import { describe, expect, it } from 'vitest';
import {
  pairWinners,
  getCustomRoundTitle,
  getTotalRounds,
  computeCustomBracketRounds,
  type CustomPair,
} from '../../utils/customBracket';

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
      homePlaceholder: 'Ganador C1',
      awayPlaceholder: 'Ganador C2',
    });

    // Ronda 2: Final con placeholders
    expect(rounds[2].title).toBe('Final');
    expect(rounds[2].matches).toHaveLength(1);
    expect(rounds[2].matches[0]).toMatchObject({
      home: null,
      away: null,
      homePlaceholder: 'Ganador C1',
      awayPlaceholder: 'Ganador C2',
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
});
