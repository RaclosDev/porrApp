import type { ParticipantScore } from '../types/api';

/**
 * Puesto de cada fila por puntos totales, con el mismo criterio que la clasificación completa:
 * los empatados comparten puesto, el siguiente es el consecutivo, y quien tiene la cuota pendiente
 * no cuenta ni tiene puesto (null).
 */
export function rankByTotal(
  rows: readonly ParticipantScore[],
): Map<ParticipantScore, number | null> {
  const totals = [...new Set(rows.filter((r) => !r.pending).map((r) => r.total || 0))].sort(
    (a, b) => b - a,
  );
  return new Map(
    rows.map((row) => [row, row.pending ? null : totals.indexOf(row.total || 0) + 1] as const),
  );
}

/** Cuántos cuentan para el puesto: quien no tiene la cuota pendiente. */
export const rankedCount = (rows: readonly ParticipantScore[]) =>
  rows.filter((r) => !r.pending).length;
