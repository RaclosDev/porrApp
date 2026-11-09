import type { GrandPrix, GrandPrixPicks, RaceDriver } from '../../types/api';

export const EMPTY_PICK: GrandPrixPicks = {
  first: null,
  second: null,
  third: null,
  pole: null,
  fastestLap: null,
};

/** Huecos de la predicción, en el orden en que se muestran. */
export const PICK_SLOTS: { key: keyof GrandPrixPicks; label: string; optional?: boolean }[] = [
  { key: 'first', label: '1.º' },
  { key: 'second', label: '2.º' },
  { key: 'third', label: '3.º' },
  { key: 'pole', label: 'Pole' },
  { key: 'fastestLap', label: 'Vuelta rápida', optional: true },
];

/**
 * Reparte los Grandes Premios: el que está en juego (cerrado, con la clasificación hecha y la carrera
 * por disputar), el próximo que aún se puede predecir, los siguientes y los ya disputados o cancelados,
 * del más reciente al más antiguo.
 */
export function splitGrandsPrix(list: GrandPrix[]) {
  const pending = list.filter((gp) => gp.status !== 'FINISHED' && gp.status !== 'CANCELLED');
  const live = pending.filter((gp) => gp.locked);
  const open = pending.filter((gp) => !gp.locked);
  const done = list
    .filter((gp) => gp.status === 'FINISHED' || gp.status === 'CANCELLED')
    .sort((a, b) => (b.raceAt ?? '').localeCompare(a.raceAt ?? ''));
  return { live, next: open[0] ?? null, upcoming: open.slice(1), done };
}

/** «Sao Paulo, Brasil» sin repetir cuando la ciudad y el país coinciden («Singapur»). */
export function placeLabel(gp: Pick<GrandPrix, 'city' | 'country'>): string {
  const parts = [gp.city, gp.country].filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(', ');
}

/** Por qué no se puede guardar la predicción, o null si está lista. */
export function pickError(pick: GrandPrixPicks): string | null {
  if (pick.first == null || pick.second == null || pick.third == null) {
    return 'Elige los tres pilotos del podio.';
  }
  if (new Set([pick.first, pick.second, pick.third]).size !== 3) {
    return 'Un piloto no puede ocupar dos puestos del podio.';
  }
  if (pick.pole == null) return 'Elige quién hará la pole.';
  return null;
}

export const samePick = (a: GrandPrixPicks | null, b: GrandPrixPicks | null) =>
  PICK_SLOTS.every(({ key }) => (a?.[key] ?? null) === (b?.[key] ?? null));

/** «L. Norris»: el nombre corto, o el completo si no lo hay. */
export const driverShortName = (driver: RaceDriver | undefined) =>
  driver ? driver.shortName || driver.name : 'Piloto';

/** «L. Norris · McLaren». */
export function driverLabel(driver: RaceDriver | undefined): string {
  if (!driver) return 'Piloto';
  const name = driver.shortName || driver.name;
  return driver.team ? `${name} · ${driver.team}` : name;
}

/** Pilotos de la parrilla ordenados por escudería y nombre, para los desplegables. */
export function gridDrivers(gp: GrandPrix, drivers: Map<number, RaceDriver>): RaceDriver[] {
  return gp.gridIds
    .map((id) => drivers.get(id))
    .filter((driver): driver is RaceDriver => Boolean(driver))
    .sort(
      (a, b) =>
        // Sin escudería conocida, al final.
        Number(a.team == null) - Number(b.team == null) ||
        (a.team ?? '').localeCompare(b.team ?? '', 'es') ||
        (a.name ?? '').localeCompare(b.name ?? '', 'es'),
    );
}

const WHEN = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** «sáb, 7 nov, 19:00» en la hora del dispositivo. */
export const formatWhen = (iso: string | null) => (iso ? WHEN.format(new Date(iso)) : '');
