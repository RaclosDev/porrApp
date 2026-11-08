import type { Group, PoolFormat } from '../types/api';

/** Se juega partido a partido sobre el calendario (jornadas), no sobre un cuadro. */
export function isMatchBasedFormat(format: PoolFormat | string | null | undefined): boolean {
  return format === 'MATCH_DAY' || format === 'SURVIVOR';
}

/** Fórmula 1: se predice Gran Premio a Gran Premio (podio, pole y vuelta rápida). */
export const isGrandPrixFormat = (format: PoolFormat | string | null | undefined): boolean =>
  format === 'GRAND_PRIX';

/** Competición que se muestra de una liga: la suya, o «Varias competiciones» si junta partidos de varias. */
export const competitionLabel = (group: Pick<Group, 'competitionName' | 'multiCompetition'>) =>
  group.multiCompetition ? 'Varias competiciones' : group.competitionName;

/** Etiqueta corta del formato para tarjetas y desplegables. */
export function poolFormatShortLabel(format: PoolFormat | string | null | undefined): string {
  if (format === 'SURVIVOR') return 'Superviviente';
  if (format === 'GRAND_PRIX') return 'Grandes Premios';
  return format === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro';
}
