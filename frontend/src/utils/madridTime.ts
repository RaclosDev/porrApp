/**
 * Fechas «de pared» en la hora de España. El servidor interpreta las fechas sin zona que recibe
 * (`2026-12-01T20:00`, lo que da un `datetime-local`) como hora de Madrid, y esa es la que ve el
 * resto de usuarios de la liga; la del navegador de quien la crea puede ser otra.
 */
const MADRID = 'Europe/Madrid';

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: MADRID,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** La hora de pared de Madrid en ese instante, como si fuera UTC (ms). */
const madridWallAsUtc = (instant: number): number => {
  const p: Record<string, string> = {};
  for (const { type, value } of parts.formatToParts(new Date(instant))) p[type] = value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
};

/**
 * Instante (ms) de una fecha sin zona (`YYYY-MM-DDTHH:mm`) leída como hora de Madrid. NaN si no es
 * una fecha válida. Al cambiar la hora, una hora que no existe se lee como la siguiente.
 */
export function madridLocalToInstant(local: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!match) return Number.NaN;
  const [year, month, day, hour, minute, second] = match.slice(1).map((n) => Number(n || 0));
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(wall)) return Number.NaN;
  // El desfase de Madrid en torno a esa fecha; se afina una vez por si cambia entre la primera
  // aproximación y el resultado (cambio de hora).
  let instant = wall - (madridWallAsUtc(wall) - wall);
  instant = wall - (madridWallAsUtc(instant) - instant);
  return instant;
}

/** `YYYY-MM-DDTHH:mm` de ese instante en hora de Madrid, el formato de un `datetime-local`. */
export function toMadridLocal(instant: Date | number = new Date()): string {
  return new Date(madridWallAsUtc(new Date(instant).getTime())).toISOString().slice(0, 16);
}
