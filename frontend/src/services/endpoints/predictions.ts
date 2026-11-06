/** Pronósticos de cuadro completo y por jornada, y sus estadísticas. */
import type {
  FriendPrediction,
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

export const createPrediction = (
  predictionData: PredictionData,
  groupId: number | string | null = null,
) =>
  request<PredictionSaved>(`/predictions${query({ groupId })}`, {
    method: 'POST',
    json: predictionData,
    fallbackError: 'Hubo un error al guardar la porra.',
  });

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
  });

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
