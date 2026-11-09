/** Pichichi de una liga: jugadores entre los que elegir, el de cada uno y los dudosos que asigna el administrador. */
import type { ScorerCandidate, ScorerPickState, ScorerPickView } from '../../types/api';
import { request } from '../http';

/** Jugadores de la competición (plantillas y goleadores); vacío si el proveedor aún no los da. */
export const fetchCompetitionPlayers = (competitionId: number) =>
  request<ScorerCandidate[]>(`/competitions/${competitionId}/players`);

export const fetchScorerPickState = (groupId: number | string) =>
  request<ScorerPickState>(`/groups/${groupId}/scorer-pick`);

/** Guarda el pichichi propio: el jugador elegido de la lista o, sin él, lo escrito. Vacío, lo quita. */
export const saveScorerPick = (
  groupId: number | string,
  pick: { name: string; playerId: string | null },
) =>
  request<ScorerPickState>(`/groups/${groupId}/scorer-pick`, {
    method: 'PUT',
    json: pick,
    fallbackError: 'No se pudo guardar el pichichi',
  });

/** Pichichis de la liga; con el plazo abierto el servidor solo devuelve el propio. */
export const fetchScorerPicks = (groupId: number | string) =>
  request<ScorerPickView[]>(`/groups/${groupId}/scorer-picks`);

/** El administrador asigna el jugador de un pichichi dudoso; con `null` quita el que asignó. */
export const assignScorerPick = (
  groupId: number | string,
  predictionId: number,
  playerId: string | null,
) =>
  request<ScorerPickView>(`/groups/${groupId}/scorer-picks/${predictionId}`, {
    method: 'PUT',
    json: { playerId },
    fallbackError: 'No se pudo asignar el jugador',
  });
