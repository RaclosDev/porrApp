import { describe, expect, it } from 'vitest';
import type { GrandPrix, GrandPrixMemberPick, GrandPrixPicks } from '../../types/api';
import {
  closedRaces,
  driverRaces,
  driverSeason,
  pickedDrivers,
  podiumAccuracy,
  rankDrivers,
  seasonFavourites,
  seasonPredictions,
  slotStatus,
  type RaceEntry,
} from '../../utils/grandPrixStats';

const NOR = 1;
const PIA = 2;
const VER = 3;
const LEC = 4;
const HAM = 5;

const picks = (
  first: number | null,
  second: number | null,
  third: number | null,
  pole: number | null,
  fastestLap: number | null = null,
): GrandPrixPicks => ({ first, second, third, pole, fastestLap });

const gp = (id: number, fields: Partial<GrandPrix> = {}): GrandPrix => ({
  id,
  name: `Gran Premio ${id}`,
  circuit: null,
  city: null,
  country: null,
  sprint: false,
  lockAt: null,
  raceAt: null,
  status: 'FINISHED',
  locked: true,
  gridIds: [],
  result: null,
  pick: null,
  points: null,
  details: null,
  ...fields,
});

const member = (userId: number, name: string, pick: GrandPrixPicks): GrandPrixMemberPick => ({
  userId,
  name,
  avatarUrl: null,
  mine: false,
  pick,
  points: null,
  details: null,
});

/** Gran Premio 1, con resultado: gana Norris desde la pole, Piastri 2.º, Verstappen 3.º y vuelta rápida. */
const first: RaceEntry = {
  gp: gp(1, { result: picks(NOR, PIA, VER, NOR, VER) }),
  picks: [
    member(10, 'Ana', picks(NOR, PIA, LEC, NOR, VER)),
    member(11, 'Berto', picks(VER, NOR, PIA, VER)),
    member(12, 'Carla', picks(NOR, VER, PIA, PIA, HAM)),
  ],
};
/** Gran Premio 2, cerrado con solo la pole decidida. */
const second: RaceEntry = {
  gp: gp(2, { status: 'LIVE', result: picks(null, null, null, VER) }),
  picks: [
    member(10, 'Ana', picks(VER, NOR, PIA, VER)),
    member(11, 'Berto', picks(NOR, VER, LEC, NOR)),
  ],
};
const season = [first, second];

describe('Grandes Premios con predicciones visibles', () => {
  it('solo entran los cerrados, no cancelados y que el servidor ha entregado', () => {
    const board = [
      gp(1),
      gp(2, { status: 'CANCELLED' }),
      gp(3, { status: 'SCHEDULED', locked: false }),
      gp(4, { status: 'LIVE' }),
      gp(5),
    ];
    const races = closedRaces(board, [
      { matchId: 1, picks: first.picks },
      { matchId: 2, picks: [] },
      // Aunque llegara por error, un Gran Premio abierto no se agrega.
      { matchId: 3, picks: second.picks },
      { matchId: 4, picks: [] },
    ]);
    expect(races.map((race) => race.gp.id)).toEqual([1, 4]);
    expect(races[0].picks).toHaveLength(3);
    expect(seasonPredictions(races)).toBe(3);
  });
});

describe('Más elegidos de un Gran Premio', () => {
  it('ordena los pilotos de más a menos elegidos y desempata por nombre', () => {
    const names: Record<number, string> = {
      [NOR]: 'Norris',
      [VER]: 'Verstappen',
      [PIA]: 'Piastri',
    };
    expect(rankDrivers(first.picks, 'first')).toEqual([
      { driverId: NOR, count: 2, percent: 67 },
      { driverId: VER, count: 1, percent: 33 },
    ]);
    expect(
      rankDrivers(first.picks, 'pole', (id) => names[id]).map((pick) => pick.driverId),
    ).toEqual([NOR, PIA, VER]);
  });

  it('en el podio cuenta a quien lo pone en cualquiera de los tres puestos', () => {
    expect(rankDrivers(first.picks, 'podium').map((p) => [p.driverId, p.count])).toEqual([
      [NOR, 3],
      [PIA, 3],
      [VER, 2],
      [LEC, 1],
    ]);
  });

  it('la vuelta rápida es opcional: el porcentaje sigue siendo sobre todas las predicciones', () => {
    expect(rankDrivers(first.picks, 'fastestLap')).toEqual([
      { driverId: VER, count: 1, percent: 33 },
      { driverId: HAM, count: 1, percent: 33 },
    ]);
  });

  it('compara con el resultado solo cuando ya se sabe', () => {
    const { result } = first.gp;
    expect(slotStatus(result, 'first', NOR)).toBe('yes');
    expect(slotStatus(result, 'first', VER)).toBe('no');
    expect(slotStatus(result, 'podium', VER)).toBe('yes');
    expect(slotStatus(result, 'podium', LEC)).toBe('no');
    expect(slotStatus(null, 'pole', NOR)).toBe('pending');
    // Con la clasificación hecha y la carrera por correr solo se sabe la pole.
    expect(slotStatus(second.gp.result, 'pole', VER)).toBe('yes');
    expect(slotStatus(second.gp.result, 'first', VER)).toBe('pending');
    expect(slotStatus(second.gp.result, 'podium', VER)).toBe('pending');
  });

  it('cuenta los pilotos del podio acertados de media', () => {
    // Ana 2 (Norris, Piastri), Berto 3 y Carla 3.
    expect(podiumAccuracy(first)).toBeCloseTo(8 / 3);
    expect(podiumAccuracy(second)).toBeNull();
    expect(podiumAccuracy({ gp: first.gp, picks: [] })).toBeNull();
  });
});

describe('Buscador de pilotos', () => {
  it('ofrece los pilotos que alguien ha puesto y, de atajo, los más elegidos para ganar', () => {
    expect([...pickedDrivers(season)].sort()).toEqual([NOR, PIA, VER, LEC, HAM]);
    expect(seasonFavourites(season, 2)).toEqual([NOR, VER]);
  });

  it('cuenta cuántas veces se pone al piloto en cada puesto y cuántas se acertó', () => {
    const rows = driverSeason(season, VER, ['any', 'podium', 'first', 'second', 'pole']);
    expect(rows).toEqual([
      // Las cinco predicciones lo tienen en algún puesto; aciertan Ana (vuelta rápida y pole del
      // segundo) y Berto no: lo puso ganador y en la pole, y fue 3.º.
      { filter: 'any', count: 5, percent: 100, hits: 2 },
      { filter: 'podium', count: 4, percent: 80, hits: 2 },
      { filter: 'first', count: 2, percent: 40, hits: 0 },
      { filter: 'second', count: 2, percent: 40, hits: 0 },
      { filter: 'pole', count: 2, percent: 40, hits: 1 },
    ]);
  });

  it('lista quién lo pone en cada Gran Premio, del más reciente al más antiguo', () => {
    const races = driverRaces(season, VER, 'any');
    expect(races.map((race) => race.gp.id)).toEqual([2, 1]);
    expect(races[0].real).toEqual(['pole']);
    expect(races[0].pickers.map((p) => [p.member.name, p.slots, p.hits])).toEqual([
      ['Ana', ['first', 'pole'], ['pole']],
      ['Berto', ['second'], []],
    ]);
    expect(races[1].real).toEqual(['third', 'fastestLap']);
    expect(races[1].pickers.map((p) => [p.member.name, p.slots, p.hits])).toEqual([
      ['Ana', ['fastestLap'], ['fastestLap']],
      ['Berto', ['first', 'pole'], []],
      ['Carla', ['second'], []],
    ]);
    expect(races[1].total).toBe(3);
    // «En cualquier puesto» no tiene un único resultado que cumplir.
    expect(races.every((race) => race.status === 'pending')).toBe(true);
  });

  it('con un puesto elegido solo salen quienes lo ponen ahí y si se cumplió', () => {
    const winner = driverRaces(season, NOR, 'first');
    expect(winner.map((race) => [race.gp.id, race.status, race.pickers.length])).toEqual([
      [2, 'pending', 1],
      [1, 'yes', 2],
    ]);
    const podium = driverRaces(season, LEC, 'podium');
    expect(podium.map((race) => [race.gp.id, race.status])).toEqual([
      [2, 'pending'],
      [1, 'no'],
    ]);
    // Nadie puso a Hamilton en la pole: no sale ningún Gran Premio.
    expect(driverRaces(season, HAM, 'pole')).toEqual([]);
  });
});
