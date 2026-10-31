/** Opciones de consulta compartidas por varios componentes (misma clave, misma función). */
import { queryOptions } from '@tanstack/react-query';
import { fetchMyGroups, fetchOfficialBracket, fetchPredictionScore } from './api';
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
