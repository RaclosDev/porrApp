import type { Group, PoolFormat, TennisScope } from '../types/api';

/** Se juega partido a partido sobre el calendario (jornadas), no sobre un cuadro. */
export function isMatchBasedFormat(format: PoolFormat | string | null | undefined): boolean {
  return format === 'MATCH_DAY' || format === 'SURVIVOR';
}

/** Nombre de una liga de tenis de varios torneos en lugar del de un torneo. */
const TENNIS_SCOPE_NAMES: Record<TennisScope, string> = {
  ALL: 'Tenis: todos los torneos',
  GRAND_SLAMS: 'Tenis: Grand Slams',
  MASTERS_1000: 'Tenis: Masters 1000 y ATP Finals',
};

/**
 * Competición que se muestra de una liga: la suya, los torneos que sigue si es de tenis de varios, o
 * «Varias competiciones» si junta partidos de varias.
 */
export const competitionLabel = (
  group: Pick<Group, 'competitionName' | 'multiCompetition' | 'tennisScope'>,
) =>
  group.tennisScope
    ? TENNIS_SCOPE_NAMES[group.tennisScope]
    : group.multiCompetition
      ? 'Varias competiciones'
      : group.competitionName;

/** Etiqueta corta del formato para tarjetas y desplegables. */
export function poolFormatShortLabel(format: PoolFormat | string | null | undefined): string {
  if (format === 'SURVIVOR') return 'Superviviente';
  if (format === 'GRAND_PRIX') return 'Grandes Premios';
  return format === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro';
}
