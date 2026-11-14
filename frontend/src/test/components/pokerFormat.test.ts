import { describe, expect, it } from 'vitest';
import { pokerStandings, settlements } from '../../components/poker/pokerFormat';
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
