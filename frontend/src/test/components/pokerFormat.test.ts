import { describe, expect, it } from 'vitest';
import {
  fullPrizes,
  noLeadingZero,
  pointsText,
  pokerStandings,
  settlements,
  standingLabel,
} from '../../components/poker/pokerFormat';
import type { PokerSession } from '../../services/endpoints/poker';

type Result = PokerSession['results'][number];

const result = (playerId: number, name: string, place: number, paid: number, prize: number) =>
  ({ playerId, name, place, paidCents: paid, prizeCents: prize, rebuys: 0, addOns: 0 }) as Result;

const session = (id: number, results: Result[]) => ({ id, results }) as PokerSession;

describe('settlements', () => {
  it('salda con los pagos mínimos', () => {
    const payments = settlements([
      result(1, 'Ana', 1, 1000, 3000),
      result(2, 'Luis', 2, 1000, 500),
      result(3, 'Eva', 3, 1000, 0),
      result(4, 'Pau', 4, 1000, 500),
    ]);
    expect(payments.map(({ from, to, cents }) => [from, to, cents])).toEqual([
      ['Eva', 'Ana', 1000],
      ['Luis', 'Ana', 500],
      ['Pau', 'Ana', 500],
    ]);
  });

  it('lo que sobra del bote también se paga, al sobrante, para que cuadre', () => {
    const payments = settlements([result(1, 'Ana', 1, 1000, 1800), result(2, 'Luis', 2, 1000, 0)]);
    expect(payments.map(({ from, toId, cents }) => [from, toId, cents])).toEqual([
      ['Luis', 1, 800],
      ['Luis', null, 200],
    ]);
  });

  it('no genera pagos si todos quedan a cero', () => {
    expect(settlements([result(1, 'Ana', 1, 0, 0), result(2, 'Luis', 2, 0, 0)])).toEqual([]);
  });
});

describe('pokerStandings: rachas', () => {
  it('cuenta los podios seguidos hasta el último torneo y la mejor racha', () => {
    // El histórico llega del más reciente al más antiguo.
    const history = [
      session(3, [result(1, 'Ana', 2, 0, 0)]),
      session(2, [result(1, 'Ana', 5, 0, 0)]),
      session(1, [result(1, 'Ana', 1, 0, 0)]),
    ];
    // Orden cronológico: podio, fuera, podio → racha actual 1, mejor 1.
    const [row] = pokerStandings(history);
    expect(row.streak).toBe(1);
    expect(row.bestStreak).toBe(1);
    const longer = pokerStandings([session(4, [result(1, 'Ana', 3, 0, 0)]), ...history])[0];
    expect(longer.streak).toBe(2);
    expect(longer.bestStreak).toBe(2);
  });
});

describe('pokerStandings: empates', () => {
  it('quien empata en todo comparte puesto; el nombre solo ordena la lista', () => {
    const history = [
      session(1, [
        result(1, 'Zoe', 1, 0, 0),
        result(2, 'Ana', 1, 0, 0),
        result(3, 'Luis', 3, 0, 0),
      ]),
    ];
    expect(pokerStandings(history).map(({ name, rank }) => [name, rank])).toEqual([
      ['Ana', 1],
      ['Zoe', 1],
      ['Luis', 3],
    ]);
  });

  it('con los mismos puntos desempatan las victorias', () => {
    const history = [session(1, [result(1, 'Toto', 2, 0, 0), result(2, 'Raclos', 1, 0, 0)])];
    expect(pokerStandings(history).map(({ name, rank }) => [name, rank])).toEqual([
      ['Raclos', 1],
      ['Toto', 2],
    ]);
  });
});

describe('fullPrizes: el sobrante cuenta en las estadísticas', () => {
  it('reparte lo que sobró en proporción a lo que se llevó cada uno', () => {
    const results = [
      result(1, 'Ana', 1, 2000, 7600),
      result(2, 'Luis', 1, 2000, 7600),
      result(3, 'Eva', 1, 2000, 7600),
    ];
    expect([...fullPrizes({ results, leftoverCents: 200 }).values()]).toEqual([7667, 7667, 7666]);
    const uneven = [
      result(1, 'Ana', 1, 0, 10000),
      result(2, 'Luis', 2, 0, 10000),
      result(3, 'Eva', 3, 0, 2500),
      result(4, 'Leo', 4, 0, 0),
    ];
    expect([...fullPrizes({ results: uneven, leftoverCents: 500 }).values()]).toEqual([
      10222, 10222, 2556, 0,
    ]);
  });

  it('no toca nada si no sobró o se repartió de más', () => {
    const results = [result(1, 'Ana', 1, 0, 5000), result(2, 'Luis', 2, 0, 0)];
    expect([...fullPrizes({ results, leftoverCents: -100 }).values()]).toEqual([5000, 0]);
    expect([...fullPrizes({ results }).values()]).toEqual([5000, 0]);
  });

  it('las estadísticas suman el bote entero y el dinero de los pagos sigue siendo el real', () => {
    const closed = {
      ...session(1, [result(1, 'Ana', 1, 1000, 1400), result(2, 'Luis', 2, 1000, 0)]),
      leftoverCents: 600,
    } as PokerSession;
    expect(pokerStandings([closed]).map((row) => [row.name, row.prizes])).toEqual([
      ['Ana', 2000],
      ['Luis', 0],
    ]);
    expect(settlements(closed.results)).toEqual([
      { fromId: 2, from: 'Luis', toId: 1, to: 'Ana', cents: 400 },
      { fromId: 2, from: 'Luis', toId: null, to: 'sobrante', cents: 600 },
    ]);
  });
});

describe('pokerStandings: puntos', () => {
  it('ordena por puntos de la liga antes que por victorias y suma decimales sin errores', () => {
    const scored = (row: Result, points: number) => ({ ...row, points });
    const rows = pokerStandings([
      session(2, [scored(result(2, 'Luis', 1, 0, 0), 4.5), scored(result(1, 'Ana', 2, 0, 0), 4.5)]),
      session(1, [scored(result(2, 'Luis', 3, 0, 0), 0.1), scored(result(1, 'Ana', 1, 0, 0), 0.2)]),
    ]);
    expect(rows.map((row) => [row.name, row.points])).toEqual([
      ['Ana', 4.7],
      ['Luis', 4.6],
    ]);
    expect(standingLabel({ points: 4.5, wins: 0, podiums: 2 })).toBe('4,5 puntos · 2 podios');
    expect(pointsText(2.25)).toBe('2,25');
  });

  it('quita el cero de delante al escribir detrás de él', () => {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '020';
    expect(noLeadingZero(input)).toBe(20);
    expect(input.value).toBe('20');
    input.value = '0';
    expect(noLeadingZero(input)).toBe(0);
    expect(input.value).toBe('0');
    input.value = '0.5';
    expect(noLeadingZero(input)).toBe(0.5);
    expect(input.value).toBe('0.5');
  });
});
