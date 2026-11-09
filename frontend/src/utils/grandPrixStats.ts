/**
 * Más elegidos y Buscador de una liga de Fórmula 1. Todo es puro: recibe los Grandes Premios ya
 * cerrados con las predicciones de la liga (antes del cierre el servidor no las entrega).
 */
import type {
  GrandPrix,
  GrandPrixMemberPick,
  GrandPrixPicks,
  GrandPrixRacePicks,
} from '../types/api';
import { percent } from './stats/entries';
import type { RealStatus } from './stats/official';

/** Huecos que se predicen tal cual. */
export type ExactSlot = keyof GrandPrixPicks;

/** Lo que se puede mirar de un piloto: un hueco exacto o estar en el podio, en cualquier puesto. */
export type RaceSlot = ExactSlot | 'podium';

/** Filtro del buscador: un hueco o `any`, que el piloto esté en cualquiera. */
export type DriverFilter = RaceSlot | 'any';

const PODIUM = ['first', 'second', 'third'] as const;
const EXACT_SLOTS: ExactSlot[] = [...PODIUM, 'pole', 'fastestLap'];

export const RACE_SLOT_LABEL: Record<DriverFilter, string> = {
  any: 'En cualquier puesto',
  first: 'Ganador',
  second: '2.º',
  third: '3.º',
  podium: 'En el podio',
  pole: 'Pole',
  fastestLap: 'Vuelta rápida',
};

/** Puesto corto, para decir dónde pone alguien a un piloto: «1.º», «Pole». */
export const SLOT_SHORT: Record<ExactSlot, string> = {
  first: '1.º',
  second: '2.º',
  third: '3.º',
  pole: 'Pole',
  fastestLap: 'Vuelta rápida',
};

/** Gran Premio cerrado con las predicciones de la liga. */
export interface RaceEntry {
  gp: GrandPrix;
  picks: GrandPrixMemberPick[];
}

/** Grandes Premios cerrados y no cancelados con sus predicciones, del primero al último. */
export function closedRaces(grandsPrix: GrandPrix[], season: GrandPrixRacePicks[]): RaceEntry[] {
  const picksOf = new Map(season.map((race) => [race.matchId, race.picks]));
  return grandsPrix
    .filter((gp) => gp.locked && gp.status !== 'CANCELLED' && picksOf.has(gp.id))
    .map((gp) => ({ gp, picks: picksOf.get(gp.id) ?? [] }));
}

/** Predicciones de la liga en toda la temporada (una por participante y Gran Premio). */
export const seasonPredictions = (races: RaceEntry[]) =>
  races.reduce((sum, race) => sum + race.picks.length, 0);

/** Pilotos que una predicción (o el resultado) tiene en el hueco. */
export function slotDrivers(picks: GrandPrixPicks | null | undefined, slot: RaceSlot): number[] {
  if (!picks) return [];
  const ids = slot === 'podium' ? PODIUM.map((key) => picks[key]) : [picks[slot]];
  return [...new Set(ids.filter((id): id is number => id != null))];
}

/** Huecos exactos en los que la predicción (o el resultado) tiene al piloto. */
const driverSlots = (picks: GrandPrixPicks | null | undefined, driverId: number) =>
  EXACT_SLOTS.filter((slot) => picks?.[slot] === driverId);

export interface DriverCount {
  driverId: number;
  count: number;
  percent: number;
}

/**
 * Pilotos más elegidos para un hueco, de más a menos; el porcentaje es sobre las predicciones del
 * Gran Premio. `nameOf` desempata por nombre.
 */
export function rankDrivers(
  picks: GrandPrixMemberPick[],
  slot: RaceSlot,
  nameOf: (driverId: number) => string = String,
): DriverCount[] {
  const counts = new Map<number, number>();
  for (const member of picks) {
    for (const id of slotDrivers(member.pick, slot)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts]
    .map(([driverId, count]) => ({ driverId, count, percent: percent(count, picks.length) }))
    .sort(
      (a, b) => b.count - a.count || nameOf(a.driverId).localeCompare(nameOf(b.driverId), 'es'),
    );
}

/** Si el piloto acabó en el hueco; `pending` mientras el resultado aún no lo dice. */
export function slotStatus(
  result: GrandPrixPicks | null | undefined,
  slot: RaceSlot,
  driverId: number,
): RealStatus {
  if (!result) return 'pending';
  if (slot === 'podium') {
    const podium = PODIUM.map((key) => result[key]);
    if (podium.includes(driverId)) return 'yes';
    return podium.every((id) => id != null) ? 'no' : 'pending';
  }
  const actual = result[slot];
  if (actual == null) return 'pending';
  return actual === driverId ? 'yes' : 'no';
}

/** Cuántos pilotos del podio real acertó de media cada predicción; null si aún no hay podio. */
export function podiumAccuracy(race: RaceEntry): number | null {
  const real = slotDrivers(race.gp.result, 'podium');
  if (real.length < PODIUM.length || race.picks.length === 0) return null;
  const hits = race.picks.reduce(
    (sum, member) =>
      sum + slotDrivers(member.pick, 'podium').filter((id) => real.includes(id)).length,
    0,
  );
  return hits / race.picks.length;
}

/** Pilotos que aparecen en alguna predicción de la temporada. */
export function pickedDrivers(races: RaceEntry[]): Set<number> {
  const ids = new Set<number>();
  for (const race of races) {
    for (const member of race.picks) {
      for (const slot of EXACT_SLOTS) {
        const id = member.pick[slot];
        if (id != null) ids.add(id);
      }
    }
  }
  return ids;
}

/** Pilotos más veces elegidos como ganador en la temporada, para los atajos del buscador. */
export function seasonFavourites(races: RaceEntry[], limit: number): number[] {
  const counts = new Map<number, number>();
  for (const race of races) {
    for (const member of race.picks) {
      const id = member.pick.first;
      if (id != null) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([id]) => id);
}

/** La predicción tiene al piloto en el hueco (con `any`, en cualquiera). */
const picksDriver = (picks: GrandPrixPicks, filter: DriverFilter, driverId: number) =>
  filter === 'any'
    ? driverSlots(picks, driverId).length > 0
    : slotDrivers(picks, filter).includes(driverId);

/** La predicción acierta con el piloto en el hueco (con `any`, en alguno de los suyos). */
function hitsDriver(
  picks: GrandPrixPicks,
  result: GrandPrixPicks | null,
  filter: DriverFilter,
  driverId: number,
): boolean {
  if (filter === 'any') {
    const real = driverSlots(result, driverId);
    return driverSlots(picks, driverId).some((slot) => real.includes(slot));
  }
  return picksDriver(picks, filter, driverId) && slotStatus(result, filter, driverId) === 'yes';
}

export interface DriverSeasonRow {
  filter: DriverFilter;
  /** Predicciones de la temporada que ponen al piloto en el hueco. */
  count: number;
  /** Sobre todas las predicciones de la temporada. */
  percent: number;
  /** Cuántas de ellas acertaron. */
  hits: number;
}

/** Cuántas veces ha puesto la liga al piloto en cada hueco a lo largo de la temporada. */
export function driverSeason(
  races: RaceEntry[],
  driverId: number,
  filters: readonly DriverFilter[],
): DriverSeasonRow[] {
  const total = seasonPredictions(races);
  return filters.map((filter) => {
    let count = 0;
    let hits = 0;
    for (const race of races) {
      for (const member of race.picks) {
        if (!picksDriver(member.pick, filter, driverId)) continue;
        count++;
        if (hitsDriver(member.pick, race.gp.result, filter, driverId)) hits++;
      }
    }
    return { filter, count, percent: percent(count, total), hits };
  });
}

interface DriverPicker {
  member: GrandPrixMemberPick;
  /** Huecos exactos en los que lo pone. */
  slots: ExactSlot[];
  /** Los que acertó. */
  hits: ExactSlot[];
}

export interface DriverRace {
  gp: GrandPrix;
  /** Predicciones que tuvo el Gran Premio. */
  total: number;
  /** Huecos reales del piloto en el Gran Premio (vacío si no acabó en ninguno o aún no se sabe). */
  real: ExactSlot[];
  /** Si se cumplió el hueco buscado; con `any` no se mira. */
  status: RealStatus;
  pickers: DriverPicker[];
}

/**
 * Gran Premio a Gran Premio, del más reciente al más antiguo, quién puso al piloto en el hueco y en
 * qué puestos. Solo salen los Grandes Premios en los que alguien lo puso.
 */
export function driverRaces(
  races: RaceEntry[],
  driverId: number,
  filter: DriverFilter,
): DriverRace[] {
  const result: DriverRace[] = [];
  for (const race of [...races].reverse()) {
    const real = driverSlots(race.gp.result, driverId);
    const pickers = race.picks
      .filter((member) => picksDriver(member.pick, filter, driverId))
      .map((member) => {
        const slots = driverSlots(member.pick, driverId);
        return { member, slots, hits: slots.filter((slot) => real.includes(slot)) };
      })
      .sort((a, b) => a.member.name.localeCompare(b.member.name, 'es'));
    if (pickers.length === 0) continue;
    result.push({
      gp: race.gp,
      total: race.picks.length,
      real,
      status: filter === 'any' ? 'pending' : slotStatus(race.gp.result, filter, driverId),
      pickers,
    });
  }
  return result;
}
