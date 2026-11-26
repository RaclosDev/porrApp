import type { PactPoints, PokerPayout } from '../../services/endpoints/poker';

/** Redondeo del dinero sugerido si el torneo no fija otro: 1 €. */
export const DEFAULT_ROUNDING_CENTS = 100;

/** Puntos de la liga por puesto, en centésimas (igual que el servidor): siempre suman 9. */
export function pointsScale(prizePlaces: number) {
  if (prizePlaces <= 1) return [900];
  if (prizePlaces === 2) return [500, 400];
  return [500, 300, 100];
}

/** Puntos enteros de cada puesto premiado: los elegidos o, si no hay, la escala de siempre. */
export function placePoints(prizePlaces: number, custom?: number[] | null) {
  const base = custom ?? pointsScale(prizePlaces).map((points) => points / 100);
  return Array.from({ length: prizePlaces }, (_, index) => base[index] ?? 0);
}

/**
 * ICM de Malmuth-Harville: lo que «vale» cada montón de fichas repartiendo `prizes` (del 1.º en
 * adelante). La probabilidad de quedar primero es la parte de las fichas, y así hacia abajo.
 */
export function icm(stacks: number[], prizes: number[]) {
  const count = stacks.length;
  const total = stacks.reduce((sum, chips) => sum + chips, 0);
  if (count === 0) return [];
  if (total <= 0)
    return stacks.map(() => prizes.slice(0, count).reduce((s, p) => s + p, 0) / count);
  const memo = new Map<number, number[]>();
  const places = Math.min(prizes.length, count);

  function equity(used: number, depth: number): number[] {
    const result = new Array<number>(count).fill(0);
    if (depth >= places) return result;
    const cached = memo.get(used);
    if (cached) return cached;
    let left = 0;
    for (let i = 0; i < count; i++) if (!(used & (1 << i))) left += stacks[i];
    for (let i = 0; i < count; i++) {
      if (used & (1 << i)) continue;
      // Sin fichas, todos los que quedan reparten por igual.
      const chance = left > 0 ? stacks[i] / left : 1 / (count - depth);
      if (chance === 0) continue;
      result[i] += chance * prizes[depth];
      const rest = equity(used | (1 << i), depth + 1);
      for (let j = 0; j < count; j++) result[j] += chance * rest[j];
    }
    memo.set(used, result);
    return result;
  }
  return equity(0, 0);
}

/**
 * Redondea cada parte a múltiplos de `step` sin pasarse del total redondeado: primero hacia abajo y
 * luego los pasos que quedan, a los que más perdieron al redondear.
 */
export function roundToStep(values: number[], step: number) {
  const floors = values.map((value) => Math.floor(value / step + 1e-9) * step);
  const budget = Math.floor(values.reduce((sum, value) => sum + value, 0) / step + 1e-9) * step;
  let spare = Math.round((budget - floors.reduce((sum, value) => sum + value, 0)) / step);
  const order = values
    .map((value, index) => ({ index, lost: value - floors[index] }))
    .sort((a, b) => b.lost - a.lost || a.index - b.index);
  for (const { index } of order) {
    if (spare <= 0) break;
    floors[index] += step;
    spare--;
  }
  return floors;
}

/** Cada parte redondeada hacia abajo: lo que no llega a un paso queda en el bote como sobrante. */
export function floorToStep(values: number[], step: number) {
  return values.map((value) => Math.floor(value / step + 1e-9) * step);
}

/** Partes iguales redondeadas hacia abajo: nadie se lleva más que otro y el resto sobra. */
export function equalSplit(total: number, count: number, step: number) {
  const each = Math.floor(total / count / step + 1e-9) * step;
  return new Array<number>(count).fill(each);
}

/** Jugador al cerrar: su puesto, con quién empata y, si sigue en la mesa y pactan, sus fichas. */
export interface PayoutStanding {
  place: number;
  playerId: number;
  tied: number[];
  chips?: number;
}

export type MoneySplit = 'ICM' | 'EQUAL';

/**
 * Reparto sugerido al cerrar. Los eliminados cobran su puesto redondeado; si varios siguen en la mesa
 * (pacto), se reparten los premios de sus puestos por ICM o a partes iguales. Los empates sin pacto
 * comparten lo de sus puestos. El dinero siempre se redondea hacia abajo: lo que no se reparte queda
 * como sobrante, a la vista para que la mesa decida si lo dona.
 */
export function suggestPayouts(
  standings: PayoutStanding[],
  prizes: number[],
  options: { step: number; money: MoneySplit; points: PactPoints; prizePoints?: number[] | null },
): PokerPayout[] {
  const scale = placePoints(prizes.length, options.prizePoints).map((points) => points * 100);
  const sumOf = (list: number[], from: number, count: number) =>
    list.slice(from, from + count).reduce((sum, value) => sum + value, 0);
  const result = new Map<number, { prizeCents: number; points: number }>();

  const pact = standings.filter((row) => row.chips !== undefined);
  if (pact.length > 1) {
    const stacks = pact.map((row) => row.chips ?? 0);
    const money = sumOf(prizes, 0, pact.length);
    const points = sumOf(scale, 0, pact.length);
    const cash =
      options.money === 'ICM'
        ? floorToStep(icm(stacks, prizes.slice(0, pact.length)), options.step)
        : equalSplit(money, pact.length, options.step);
    const pts =
      options.points === 'ICM'
        ? roundToStep(icm(stacks, scale.slice(0, pact.length)), 1)
        : equalSplit(points, pact.length, 1);
    pact.forEach((row, index) =>
      result.set(row.playerId, { prizeCents: cash[index], points: pts[index] }),
    );
  }

  for (const row of standings) {
    if (result.has(row.playerId)) continue;
    const count = row.tied.length;
    const money = sumOf(prizes, row.place - 1, count);
    const points = sumOf(scale, row.place - 1, count);
    result.set(row.playerId, {
      prizeCents: equalSplit(money, count, options.step)[0],
      points: equalSplit(points, count, 1)[0],
    });
  }

  return standings.map((row) => {
    const payout = result.get(row.playerId) ?? { prizeCents: 0, points: 0 };
    return { playerId: row.playerId, prizeCents: payout.prizeCents, points: payout.points / 100 };
  });
}
