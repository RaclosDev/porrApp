import { describe, expect, it } from 'vitest';
import {
  draftToRules,
  sameRules,
  scoringSections,
  scoringValueError,
  toDraft,
} from '../../utils/scoringRules';
import { DEFAULT_SCORING } from '../fixtures';

const keysOf = (format: Parameters<typeof scoringSections>[0], pichichi: boolean) =>
  scoringSections(format, pichichi).flatMap((section) => section.fields.map((field) => field.key));

describe('scoringRules', () => {
  it('cada formato muestra sus reglas', () => {
    expect(keysOf('MATCH_DAY', true)).toEqual([
      'exactScorePoints',
      'correctSignPoints',
      'goalDiffBonusPoints',
    ]);
    expect(keysOf('FULL_BRACKET', true)).toContain('groupQualifierPoints');
    expect(keysOf('FULL_BRACKET', true)).toContain('topScorerPoints');
    expect(keysOf('FULL_BRACKET', false)).not.toContain('topScorerPoints');
    expect(keysOf('KNOCKOUTS_ONLY', true)).not.toContain('groupQualifierPoints');
    expect(keysOf('KNOCKOUTS_ONLY', true)).toContain('roundOf32Points');
    // Sin formato conocido se tratan como cuadro completo.
    expect(keysOf(null, false)).toEqual(keysOf('FULL_BRACKET', false));
  });

  it('las reglas del cuadro y las de jornadas cubren todas las del backend', () => {
    const shown = new Set([...keysOf('FULL_BRACKET', true), ...keysOf('MATCH_DAY', true)]);
    expect([...shown].sort()).toEqual(Object.keys(DEFAULT_SCORING).sort());
  });

  it('solo admite enteros entre 0 y el máximo', () => {
    expect(scoringValueError('0', 1000)).toBeNull();
    expect(scoringValueError(' 1000 ', 1000)).toBeNull();
    expect(scoringValueError('1001', 1000)).toBe('Como máximo 1000.');
    for (const value of ['', '-1', '2.5', '1e3', 'diez']) {
      expect(scoringValueError(value, 1000)).toBe('Escribe un número entero, 0 o más.');
    }
  });

  it('convierte el borrador en reglas y compara reglas', () => {
    const draft = { ...toDraft(DEFAULT_SCORING), championPoints: '300' };

    expect(draftToRules(draft, 1000)).toEqual({ ...DEFAULT_SCORING, championPoints: 300 });
    expect(draftToRules({ ...draft, runnerUpPoints: '' }, 1000)).toBeNull();
    expect(sameRules(DEFAULT_SCORING, { ...DEFAULT_SCORING })).toBe(true);
    expect(sameRules(DEFAULT_SCORING, { ...DEFAULT_SCORING, goalDiffBonusPoints: 0 })).toBe(false);
  });
});
