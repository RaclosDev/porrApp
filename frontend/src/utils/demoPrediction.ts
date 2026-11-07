import type { ParticipantScore } from '../types/api';

/**
 * Porra que enseña la demo en «Mi porra»: la del primero de la clasificación. En empate a puntos
 * se queda la que el servidor pone antes.
 */
export function leaderPredictionId(rows: readonly ParticipantScore[]): string | null {
  let leader: ParticipantScore | null = null;
  for (const row of rows) {
    if (leader == null || row.total > leader.total) leader = row;
  }
  return leader ? String(leader.id) : null;
}
