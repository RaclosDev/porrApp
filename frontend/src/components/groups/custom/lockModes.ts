import type { CustomLockMode } from '../../../services/api';

export interface LockModeOption {
  value: CustomLockMode;
  label: string;
  hint: string;
}

/** Ligas de cuadro. Por rondas y por partidos solo existen al pronosticar cruce a cruce. */
export const BRACKET_LOCK_MODES: LockModeOption[] = [
  {
    value: 'FIXED_DATE',
    label: 'En una fecha fija',
    hint: 'Todas las predicciones se cierran a la vez en la fecha que elijas.',
  },
  {
    value: 'FIRST_MATCH',
    label: 'Al empezar el primer partido',
    hint: 'Todo se cierra a la vez cuando empieza el primer partido, o antes si pones margen. Sigue al calendario aunque cambies partidos.',
  },
  {
    value: 'PER_ROUND',
    label: 'Por rondas',
    hint: 'Cada grupo y cada ronda del cuadro se cierran al empezar su primer partido. El resto se puede cambiar hasta entonces.',
  },
  {
    value: 'PER_MATCH',
    label: 'Por partidos',
    hint: 'Cada cruce se cierra al empezar ese partido; cada grupo, al empezar su primer partido.',
  },
];

/** Ligas por jornadas: cada partido se pronostica por separado. */
const MATCHDAY_LOCK_MODES: LockModeOption[] = [
  {
    value: 'PER_MATCH',
    label: 'Cada partido',
    hint: 'Cada partido se cierra al empezar, o antes si pones margen.',
  },
  {
    value: 'PER_DAY',
    label: 'Por días',
    hint: 'Todos los partidos de un mismo día se cierran al empezar el primero de ese día. Con 1 día de margen, se cierran la víspera.',
  },
  {
    value: 'PER_ROUND',
    label: 'Por jornadas',
    hint: 'Toda la jornada se cierra al empezar su primer partido, o antes si pones margen.',
  },
];

/**
 * Ligas que juntan partidos de varias competiciones: su jornada es la semana, de lunes a domingo, y se
 * cierra con su primer partido sea de la competición que sea.
 */
const MULTI_COMPETITION_LOCK_MODES: LockModeOption[] = MATCHDAY_LOCK_MODES.map((item) =>
  item.value === 'PER_ROUND'
    ? {
        ...item,
        label: 'Por semanas',
        hint: 'Toda la semana, de lunes a domingo, se cierra al empezar su primer partido, sea de la competición que sea, o antes si pones margen.',
      }
    : item,
);

/**
 * Ligas de la UFC. ESPN da la hora de cada bloque de la cartelera (preliminares y estelar), no la de
 * cada pelea: por defecto se cierra toda la velada al empezar, igual para todos.
 */
export const FIGHT_NIGHT_LOCK_MODES: LockModeOption[] = [
  {
    value: 'PER_ROUND',
    label: 'Al empezar la velada',
    hint: 'Todas las peleas se cierran cuando empiezan los primeros preliminares, o antes si pones margen.',
  },
  {
    value: 'PER_MATCH',
    label: 'Por bloques',
    hint: 'Cada pelea se cierra al empezar su bloque: preliminares o cartelera estelar.',
  },
];

/** NFL: la jornada es la semana de la liga, del jueves al lunes, con el número que le da la NFL. */
const NFL_WEEK_LOCK_MODES: LockModeOption[] = MATCHDAY_LOCK_MODES.map((item) =>
  item.value === 'PER_ROUND'
    ? {
        ...item,
        label: 'Por semanas',
        hint: 'Toda la semana, del jueves al lunes, se cierra al empezar su primer partido, o antes si pones margen.',
      }
    : item,
);

/**
 * Cierres de una liga por jornadas: con varias competiciones, la jornada es la semana de lunes a
 * domingo; en la NFL, la semana de la liga.
 */
export const matchdayLockModes = (multiCompetition: boolean, nfl = false) =>
  multiCompetition ? MULTI_COMPETITION_LOCK_MODES : nfl ? NFL_WEEK_LOCK_MODES : MATCHDAY_LOCK_MODES;

/** Los modos que solo aceptan cerrar todo a la vez, sin rondas ni partidos. */
/** Eliminatorias sorteadas ronda a ronda: las rondas siguientes aún no tienen cruces, no se cierra todo a la vez. */
export const DRAWN_KNOCKOUT_LOCK_MODES: LockModeOption[] = [
  {
    value: 'PER_ROUND',
    label: 'Por rondas',
    hint: 'Cada ronda se abre tras su sorteo y se cierra al empezar su primer partido.',
  },
  {
    value: 'PER_MATCH',
    label: 'Por eliminatorias',
    hint: 'Cada eliminatoria se cierra al empezar su partido de ida.',
  },
];

/** Playoffs de la NBA: cada serie se abre al conocerse sus dos equipos y se cierra al empezar. */
export const SERIES_LOCK_MODES: LockModeOption[] = [
  {
    value: 'PER_MATCH',
    label: 'Por series',
    hint: 'Cada serie se cierra al empezar su primer partido. Las demás se pueden cambiar hasta entonces.',
  },
  {
    value: 'PER_ROUND',
    label: 'Por rondas',
    hint: 'Todas las series de una ronda se cierran al empezar la primera.',
  },
];

export const SINGLE_LOCK_MODES = BRACKET_LOCK_MODES.filter(
  (item) => item.value === 'FIXED_DATE' || item.value === 'FIRST_MATCH',
);

export type LockUnit = 'minutes' | 'hours' | 'days';
export const LOCK_UNIT_MINUTES: Record<LockUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** Margen máximo antes del partido que admite el servidor: 30 días. */
export const MAX_LOCK_OFFSET_MINUTES = 30 * 1440;

export function splitLockOffset(minutes: number): { amount: number; unit: LockUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

/** «2 horas antes», «1 día antes» o vacío sin margen. */
export function describeLockOffset(offsetMinutes: number): string {
  if (!offsetMinutes) return '';
  const { amount, unit } = splitLockOffset(offsetMinutes);
  const unitLabel = {
    minutes: 'min',
    hours: amount === 1 ? 'hora' : 'horas',
    days: amount === 1 ? 'día' : 'días',
  }[unit];
  return `${amount} ${unitLabel} antes`;
}
