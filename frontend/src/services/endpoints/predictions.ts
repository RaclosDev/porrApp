/** Pronósticos de cuadro completo y por jornada, y sus estadísticas. */
import type {
  FriendPrediction,
  GrandPrixBoard,
  GrandPrixMemberPick,
  GrandPrixPicks,
  MatchdayFixture,
  MatchdayPredictionInput,
  MatchdayStats,
  MatchVoter,
  MatchVoters,
  MatchdaySubmissionResult,
  ParticipantScore,
  PredictionData,
  PredictionSaved,
  PredictionSummary,
  SurvivorStatus,
} from '../../types/api';
import { request, query } from '../http';

export const fetchPrediction = (id: number | string) =>
  request<PredictionData>(`/predictions/${id}`, { fallbackError: 'Error al cargar la porra' });

/** Desglose de puntos de un pronóstico. Se cachea como consulta (`predictionScoreQuery`). */
export const fetchPredictionScore = (id: number | string) =>
  request<ParticipantScore>(`/predictions/${id}/score`);

export const fetchPredictions = (groupId: number | string | null = null) =>
  request<PredictionSummary[]>(`/predictions${query({ groupId })}`);

export const fetchMyPredictions = () => request<PredictionSummary[]>('/predictions/mine');

/** Se lanza en `window` tras guardar una predicción (la cabecera ofrece entonces instalar la app). */
export const PREDICTION_SAVED_EVENT = 'prediction-saved';

function announceSaved<T>(result: T): T {
  window.dispatchEvent(new Event(PREDICTION_SAVED_EVENT));
  return result;
}

export const createPrediction = (
  predictionData: PredictionData,
  groupId: number | string | null = null,
) =>
  request<PredictionSaved>(`/predictions${query({ groupId })}`, {
    method: 'POST',
    json: predictionData,
    fallbackError: 'Hubo un error al guardar la porra.',
  }).then(announceSaved);

export const fetchMatchdayFixtures = (groupId: number | string, round = '') =>
  request<MatchdayFixture[]>(`/predictions/matchday${query({ groupId, round })}`);

export const submitMatchdayPredictions = (
  groupId: number | string,
  predictions: MatchdayPredictionInput[],
) =>
  request<MatchdaySubmissionResult>('/predictions/matchday', {
    method: 'POST',
    json: { groupId: Number(groupId), predictions },
    fallbackError: 'Error al guardar las predicciones de la jornada',
  }).then(announceSaved);

/** Situación del usuario en una liga superviviente: si sigue vivo y qué equipos ha usado. */
export const fetchSurvivorStatus = (groupId: number | string) =>
  request<SurvivorStatus>(`/predictions/matchday/survivor${query({ groupId })}`);

export const fetchMatchdayFriendPredictions = (groupId: number | string, matchId: number) =>
  request<FriendPrediction[]>(
    `/predictions/matchday/matches/${matchId}/predictions${query({ groupId })}`,
  );

/** Reparto 1X2 y marcadores más repetidos de los partidos ya empezados de una liga por jornadas. */
export const fetchMatchdayStats = (groupId: number | string) =>
  request<MatchdayStats>(`/predictions/matchday/stats${query({ groupId })}`);

/** Votantes de cada signo; el servidor solo devuelve los partidos ya cerrados. */
export const fetchMatchVoters = (groupId: number | string, matchIds: number[]) =>
  request<MatchVoters[]>(
    `/predictions/matchday/stats/voters${query({ groupId, matchIds: matchIds.join(',') })}`,
  );

/** Miembros que ya han hecho su predicción en alguno de los partidos (quién, no qué). */
export const fetchRoundParticipants = (groupId: number | string, matchIds: number[]) =>
  request<MatchVoter[]>(
    `/predictions/matchday/stats/participants${query({ groupId, matchIds: matchIds.join(',') })}`,
  );

/** Grandes Premios de una liga de Fórmula 1 con la predicción del usuario y los resultados. */
export const fetchGrandPrixBoard = (groupId: number | string) =>
  request<GrandPrixBoard>(`/grand-prix${query({ groupId })}`, {
    fallbackError: 'No se pudieron cargar los Grandes Premios',
  });

/** Guarda la predicción de un Gran Premio; devuelve los Grandes Premios actualizados. */
export const saveGrandPrixPick = (
  groupId: number | string,
  matchId: number,
  pick: GrandPrixPicks,
) =>
  request<GrandPrixBoard>(`/grand-prix/${matchId}${query({ groupId })}`, {
    method: 'PUT',
    json: pick,
    fallbackError: 'No se pudo guardar la predicción',
  });

/** Predicciones de la liga para un Gran Premio; antes del cierre, solo la propia. */
export const fetchGrandPrixMemberPicks = (groupId: number | string, matchId: number) =>
  request<GrandPrixMemberPick[]>(`/grand-prix/${matchId}/picks${query({ groupId })}`);
