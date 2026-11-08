import { describe, expect, it } from 'vitest';
import { standingsZones, zoneOf } from '../../utils/standingsZones';

describe('standingsZones', () => {
  it('marca octavos, playoff y eliminados en la fase de liga de la Champions', () => {
    const zones = standingsZones('uefa.champions');
    expect(zoneOf(zones, 8, 36)?.label).toBe('Octavos de final');
    expect(zoneOf(zones, 9, 36)?.label).toBe('Playoff de octavos');
    expect(zoneOf(zones, 24, 36)?.tone).toBe('middle');
    expect(zoneOf(zones, 25, 36)?.label).toBe('Eliminado');
  });

  it('cuenta el descenso desde el final de la tabla', () => {
    const laLiga = standingsZones('esp.1');
    expect(zoneOf(laLiga, 4, 20)?.label).toBe('Champions League');
    expect(zoneOf(laLiga, 10, 20)).toBeNull();
    expect(zoneOf(laLiga, 17, 20)).toBeNull();
    expect(zoneOf(laLiga, 18, 20)?.label).toBe('Descenso');

    const bundesliga = standingsZones('ger.1');
    expect(zoneOf(bundesliga, 16, 18)?.label).toBe('Promoción de descenso');
    expect(zoneOf(bundesliga, 17, 18)?.label).toBe('Descenso');
  });

  it('no inventa zonas en competiciones sin reglamento conocido', () => {
    expect(standingsZones('usa.1')).toEqual([]);
    expect(standingsZones(null)).toEqual([]);
  });
});
