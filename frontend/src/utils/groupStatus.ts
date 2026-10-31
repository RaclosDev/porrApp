/**
 * Estado matemático de un equipo en su grupo, como lo calcula el backend
 * (`MathematicalStatusCalculator`): 1-4 puesto asegurado, 5 entre los dos primeros,
 * -1 eliminado y 0 aún abierto.
 */
export const isMathematicallyQualified = (status: number | null | undefined): boolean =>
  status === 1 || status === 2 || status === 5;

/** Un 4.º asegurado también está fuera: en un grupo de cuatro no pasa a dieciseisavos. */
export const isMathematicallyEliminated = (status: number | null | undefined): boolean =>
  status === 4 || status === -1;
