import { describe, expect, it } from 'vitest';
import { pairWinners } from '../../utils/customBracket';

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
});
