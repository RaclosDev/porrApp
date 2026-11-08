import { describe, expect, it } from 'vitest';
import { parseTennisScore, tennisEndingLabel, tennisScoreText } from '../../utils/tennisScore';
import { finishedLabel } from '../../utils/matchday';

describe('marcador de tenis', () => {
  it('lee los juegos de cada set y el tie-break', () => {
    expect(parseTennisScore('6-4 6-7(5) 7-6(10)')).toEqual({
      sets: [
        { home: 6, away: 4, tiebreak: null },
        { home: 6, away: 7, tiebreak: 5 },
        { home: 7, away: 6, tiebreak: 10 },
      ],
      ending: null,
    });
  });

  it('lee cómo acabó un partido que no se jugó entero', () => {
    const retired = parseTennisScore('6-4 2-1 RET');
    expect(retired?.sets).toHaveLength(2);
    expect(tennisEndingLabel(retired)).toBe('retirada');
    expect(parseTennisScore('WO')).toEqual({ sets: [], ending: 'WO' });
    expect(tennisEndingLabel(parseTennisScore('6-1 DEF'))).toBe('descalificación');
  });

  it('no confunde el reloj de otros deportes', () => {
    for (const clock of [null, '', "67'", 'PEN 4-2', 'OT', 'Descanso', '3.er cuarto · 5:00']) {
      expect(parseTennisScore(clock)).toBeNull();
    }
  });

  it('escribe el marcador y la etiqueta de terminado', () => {
    expect(tennisScoreText(parseTennisScore('6-4 2-1 RET')!)).toBe('6-4 2-1 · retirada');
    expect(finishedLabel('7-6(3) 6-4')).toBe('Final · 7-6(3) 6-4');
    expect(finishedLabel('WO')).toBe('Final · W.O.');
    expect(finishedLabel('PEN 4-2')).toBe('Final · 4-2 en penaltis');
  });
});
