import type { PoolFormat } from '../types/api';

/** Se juega partido a partido sobre el calendario (jornadas), no sobre un cuadro. */
export function isMatchBasedFormat(format: PoolFormat | string | null | undefined): boolean {
  return format === 'MATCH_DAY' || format === 'SURVIVOR';
}

/** Etiqueta corta del formato para tarjetas y desplegables. */
export function poolFormatShortLabel(format: PoolFormat | string | null | undefined): string {
  if (format === 'SURVIVOR') return 'Superviviente';
  return format === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro';
}
