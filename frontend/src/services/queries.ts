/** Opciones de consulta compartidas por varios componentes (misma clave, misma función). */
import { queryOptions } from '@tanstack/react-query';
import {
  fetchLeaderboardMatchdays,
  fetchMyGroups,
  fetchMyPredictions,
  fetchOfficialBracket,
  fetchPredictions,
  fetchPredictionScore,
} from './api';
import { queryKeys } from './queryKeys';

export const myGroupsQuery = (isAuthenticated: boolean) =>
  queryOptions({
    queryKey: queryKeys.myGroups(isAuthenticated),
    queryFn: () => (isAuthenticated ? fetchMyGroups() : Promise.resolve([])),
    staleTime: 60_000,
  });

/** Cuadro oficial; lo invalida el WebSocket cuando cambia un resultado. */
export const officialBracketQuery = () =>
  queryOptions({
    queryKey: queryKeys.officialBracket(),
    queryFn: fetchOfficialBracket,
    staleTime: 60_000,
  });

/** Desglose de puntos de un pronóstico; el cálculo es costoso, así que se reutiliza 60 s. */
export const predictionScoreQuery = (predictionId: number | string) =>
  queryOptions({
    queryKey: queryKeys.predictionScore(String(predictionId)),
    queryFn: () => fetchPredictionScore(predictionId),
    staleTime: 60_000,
  });

/** Jornadas de la liga con sus puntos; la jornada actual viene marcada con `current`. */
export const leaderboardMatchdaysQuery = (groupId: number | string) =>
  queryOptions({
    queryKey: queryKeys.leaderboardMatchdays(groupId),
    queryFn: () => fetchLeaderboardMatchdays(groupId),
    staleTime: 60_000,
  });

/**
 * Pronósticos de todos los participantes de una liga, con sus cuadros. Es una respuesta pesada:
 * solo la piden las pantallas que la usan (ver `useLeaguePredictions`).
 */
export const leaguePredictionsQuery = (groupId: string | null) =>
  queryOptions({
    queryKey: queryKeys.predictions(groupId),
    queryFn: () => fetchPredictions(groupId),
    enabled: Boolean(groupId),
    retry: 1,
  });

/** Pronósticos del usuario en todas sus ligas: basta para saber si ya tiene porra en una. */
export const myPredictionsQuery = (isAuthenticated: boolean) =>
  queryOptions({
    queryKey: queryKeys.myPredictions(),
    queryFn: fetchMyPredictions,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
