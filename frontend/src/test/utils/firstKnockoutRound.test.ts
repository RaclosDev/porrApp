import { describe, expect, it } from 'vitest';
import {
  WORLD_CUP_2026_FIRST_ROUND,
  firstRoundInLegacyOrder,
  firstRoundLabels,
  groupSpot,
  isThirdSlot,
  slotLabel,
} from '../../utils/firstKnockoutRound';

describe('cruces de la primera ronda eliminatoria', () => {
  it('escribe cada hueco como lo ve el usuario', () => {
    expect(slotLabel('1E')).toBe('1º Grupo E');
    expect(slotLabel('2A')).toBe('2º Grupo A');
    expect(slotLabel('3ABCDF')).toBe('3º A/B/C/D/F');
    expect(isThirdSlot('3ABCDF')).toBe(true);
    expect(groupSpot('2L')).toEqual({ position: 'second', group: 'L' });
  });

  it('el Mundial 2026 conserva sus dieciseisavos en el orden del cuadro y en el antiguo', () => {
    const labels = firstRoundLabels(WORLD_CUP_2026_FIRST_ROUND);
    expect(labels).toHaveLength(16);
    expect(labels[0]).toEqual(['1º Grupo E', '3º A/B/C/D/F']);
    expect(labels[2]).toEqual(['2º Grupo A', '2º Grupo B']);
    expect(labels[15]).toEqual(['1º Grupo K', '3º D/E/I/J/L']);

    const legacy = firstRoundInLegacyOrder(WORLD_CUP_2026_FIRST_ROUND);
    expect(legacy[2]).toEqual(['1F', '2C']);
    expect(legacy[4]).toEqual(['2A', '2B']);
    // Cada grupo da un primero y un segundo; ocho huecos son de terceros.
    const slots = legacy.flat();
    expect(slots.filter(isThirdSlot)).toHaveLength(8);
    expect(new Set(slots.filter((slot) => !isThirdSlot(slot))).size).toBe(24);
  });
});
