import { describe, expect, it } from 'vitest';
import type { GrandPrix, RaceDriver } from '../../types/api';
import {
  EMPTY_PICK,
  driverLabel,
  gridDrivers,
  pickError,
  placeLabel,
  samePick,
  splitGrandsPrix,
} from '../../components/grandPrix/grandPrix';

const gp = (overrides: Partial<GrandPrix>): GrandPrix => ({
  id: 1,
  name: 'GP de São Paulo',
  circuit: null,
  city: null,
  country: null,
  sprint: false,
  lockAt: '2026-11-07T18:00:00Z',
  raceAt: '2026-11-08T17:00:00Z',
  status: 'SCHEDULED',
  locked: false,
  gridIds: [],
  result: null,
  pick: null,
  points: null,
  details: null,
  ...overrides,
});

const driver = (id: number, name: string, team: string | null): RaceDriver => ({
  id,
  name,
  shortName: name.replace(/^(\w)\w* /, '$1. '),
  country: null,
  flagUrl: null,
  team,
  teamColor: null,
  number: null,
});

describe('Grandes Premios', () => {
  it('separa el que está en juego, el próximo abierto, los siguientes y los disputados', () => {
    const list = [
      gp({ id: 1, status: 'FINISHED', raceAt: '2026-10-25T20:00:00Z' }),
      gp({ id: 2, status: 'CANCELLED', raceAt: '2026-04-12T15:00:00Z' }),
      gp({ id: 3, status: 'FINISHED', raceAt: '2026-11-01T20:00:00Z' }),
      gp({ id: 4, status: 'LIVE', locked: true }),
      gp({ id: 5 }),
      gp({ id: 6 }),
    ];
    const { live, next, upcoming, done } = splitGrandsPrix(list);
    expect(live.map((item) => item.id)).toEqual([4]);
    expect(next?.id).toBe(5);
    expect(upcoming.map((item) => item.id)).toEqual([6]);
    expect(done.map((item) => item.id)).toEqual([3, 1, 2]);
    expect(splitGrandsPrix([]).next).toBeNull();
  });

  it('no repite la ciudad cuando coincide con el país', () => {
    expect(placeLabel({ city: 'São Paulo', country: 'Brasil' })).toBe('São Paulo, Brasil');
    expect(placeLabel({ city: 'Singapur', country: 'Singapur' })).toBe('Singapur');
    expect(placeLabel({ city: null, country: 'Mónaco' })).toBe('Mónaco');
  });

  it('pide el podio completo sin repetir piloto y la pole; la vuelta rápida es opcional', () => {
    expect(pickError(EMPTY_PICK)).toMatch(/tres pilotos/);
    expect(pickError({ ...EMPTY_PICK, first: 1, second: 1, third: 2 })).toMatch(/dos puestos/);
    expect(pickError({ ...EMPTY_PICK, first: 1, second: 2, third: 3 })).toMatch(/pole/);
    expect(pickError({ ...EMPTY_PICK, first: 1, second: 2, third: 3, pole: 1 })).toBeNull();
    expect(samePick({ ...EMPTY_PICK, first: 1 }, { ...EMPTY_PICK, first: 1 })).toBe(true);
    expect(samePick(null, { ...EMPTY_PICK, pole: 2 })).toBe(false);
  });

  it('ordena la parrilla por escudería y nombra a cada piloto con su equipo', () => {
    const drivers = new Map(
      [
        driver(1, 'Lando Norris', 'McLaren'),
        driver(2, 'George Russell', 'Mercedes'),
        driver(3, 'Oscar Piastri', 'McLaren'),
        driver(4, 'Nuevo Piloto', null),
      ].map((item) => [item.id, item]),
    );
    const grid = gridDrivers(gp({ gridIds: [2, 4, 3, 1, 99] }), drivers);
    expect(grid.map((item) => item.id)).toEqual([1, 3, 2, 4]);
    expect(driverLabel(drivers.get(1))).toBe('L. Norris · McLaren');
    expect(driverLabel(drivers.get(4))).toBe('N. Piloto');
    expect(driverLabel(undefined)).toBe('Piloto');
  });
});
