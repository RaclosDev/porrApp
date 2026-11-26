import { describe, expect, it } from 'vitest';
import {
  equalSplit,
  icm,
  placePoints,
  pointsScale,
  roundToStep,
  suggestPayouts,
} from '../../components/poker/pokerPayouts';

describe('pokerPayouts', () => {
  it('reparte siempre 9 puntos según los puestos premiados', () => {
    expect(pointsScale(1)).toEqual([900]);
    expect(pointsScale(2)).toEqual([500, 400]);
    expect(pointsScale(4)).toEqual([500, 300, 100]);
  });

  it('valora las fichas con ICM y suma el premio completo', () => {
    const values = icm([20000, 10000], [2100, 900]);
    expect(values.map(Math.round)).toEqual([1700, 1300]);
    const three = icm([25000, 15000, 10000], [9500, 5700, 3800]);
    expect(three.reduce((sum, value) => sum + value, 0)).toBeCloseTo(19000);
    expect(three[0]).toBeGreaterThan(three[1]);
    expect(icm([0, 0], [100, 50])).toEqual([75, 75]);
  });

  it('redondea sin pasarse del total y deja el resto de las partes iguales como sobrante', () => {
    expect(roundToStep([6333, 6333, 6334], 1000)).toEqual([6000, 6000, 7000]);
    expect(equalSplit(19000, 3, 1000)).toEqual([6000, 6000, 6000]);
  });

  it('sugiere el pacto de los supervivientes y el premio de cada eliminado', () => {
    const standings = [
      { place: 1, playerId: 1, tied: [1], chips: 25000 },
      { place: 1, playerId: 2, tied: [2], chips: 15000 },
      { place: 3, playerId: 3, tied: [3] },
      { place: 4, playerId: 4, tied: [4] },
    ];
    const equal = suggestPayouts(standings, [10000, 6000, 4000], {
      step: 1000,
      money: 'EQUAL',
      points: 'EQUAL',
    });
    expect(equal).toEqual([
      { playerId: 1, prizeCents: 8000, points: 4 },
      { playerId: 2, prizeCents: 8000, points: 4 },
      { playerId: 3, prizeCents: 4000, points: 1 },
      { playerId: 4, prizeCents: 0, points: 0 },
    ]);
    const byChips = suggestPayouts(standings, [10000, 6000, 4000], {
      step: 1000,
      money: 'ICM',
      points: 'ICM',
    });
    expect(byChips[0].prizeCents + byChips[1].prizeCents).toBe(16000);
    expect(byChips[0].points + byChips[1].points).toBe(8);
    expect(byChips[0].points).toBeGreaterThan(byChips[1].points);
  });

  it('los empates sin pacto comparten lo de sus puestos', () => {
    const tied = suggestPayouts(
      [
        { place: 1, playerId: 1, tied: [1] },
        { place: 2, playerId: 2, tied: [2, 3] },
        { place: 2, playerId: 3, tied: [2, 3] },
      ],
      [5000, 3000, 1000],
      { step: 100, money: 'ICM', points: 'EQUAL' },
    );
    expect(tied.map((row) => [row.prizeCents, row.points])).toEqual([
      [5000, 5],
      [2000, 2],
      [2000, 2],
    ]);
  });

  it('usa los puntos elegidos por puesto y rellena con 0 los puestos sin puntos', () => {
    expect(placePoints(3)).toEqual([5, 3, 1]);
    expect(placePoints(2, [10, 6, 3])).toEqual([10, 6]);
    expect(placePoints(3, [10])).toEqual([10, 0, 0]);
    const payouts = suggestPayouts(
      [
        { place: 1, playerId: 1, tied: [1] },
        { place: 2, playerId: 2, tied: [2] },
      ],
      [7000, 3000],
      { step: 100, money: 'EQUAL', points: 'EQUAL', prizePoints: [12, 7] },
    );
    expect(payouts.map((payout) => payout.points)).toEqual([12, 7]);
  });
});
