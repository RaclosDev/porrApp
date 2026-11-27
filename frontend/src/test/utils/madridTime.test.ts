import { describe, expect, it } from 'vitest';
import { madridLocalToInstant, toMadridLocal } from '../../utils/madridTime';

describe('madridTime', () => {
  it('lee una fecha sin zona como hora de Madrid, en invierno y en verano', () => {
    expect(new Date(madridLocalToInstant('2026-12-01T20:00')).toISOString()).toBe(
      '2026-12-01T19:00:00.000Z',
    );
    expect(new Date(madridLocalToInstant('2026-07-01T20:00')).toISOString()).toBe(
      '2026-07-01T18:00:00.000Z',
    );
  });

  it('acierta con la hora el día del cambio de hora', () => {
    // El 29 de marzo de 2026 a las 03:00 se pasa a CEST (+02:00); antes, +01:00.
    expect(new Date(madridLocalToInstant('2026-03-29T01:30')).toISOString()).toBe(
      '2026-03-29T00:30:00.000Z',
    );
    expect(new Date(madridLocalToInstant('2026-03-29T04:00')).toISOString()).toBe(
      '2026-03-29T02:00:00.000Z',
    );
    // El 25 de octubre de 2026 a las 03:00 se vuelve a CET (+01:00).
    expect(new Date(madridLocalToInstant('2026-10-25T04:00')).toISOString()).toBe(
      '2026-10-25T03:00:00.000Z',
    );
  });

  it('devuelve NaN con algo que no es una fecha', () => {
    expect(madridLocalToInstant('')).toBeNaN();
    expect(madridLocalToInstant('mañana')).toBeNaN();
    expect(madridLocalToInstant('2026-12-01')).toBeNaN();
  });

  it('da la hora de Madrid de un instante en el formato de un datetime-local', () => {
    expect(toMadridLocal(Date.parse('2026-12-01T19:00:00Z'))).toBe('2026-12-01T20:00');
    expect(toMadridLocal(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02T00:30');
  });

  it('ida y vuelta', () => {
    expect(toMadridLocal(madridLocalToInstant('2026-12-31T23:59'))).toBe('2026-12-31T23:59');
  });
});
