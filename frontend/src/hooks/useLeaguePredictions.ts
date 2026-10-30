import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaguePredictionsQuery, myPredictionsQuery } from '../services/queries';
import { useAppStore } from '../store/useAppStore';
import { isGlobalLeagueId } from '../utils/constants';
import type { PredictionSummary } from '../types/api';

const NO_PREDICTIONS: PredictionSummary[] = [];

/**
 * Pronósticos de todos los participantes de la liga activa. Los piden solo las pantallas que los
 * usan; `useAppContext().participantsHashes` lee los mismos datos de la caché sin pedirlos.
 */
export function useLeaguePredictions(): PredictionSummary[] {
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const { data } = useQuery(leaguePredictionsQuery(activeGroupId));
  return Array.isArray(data) ? data : NO_PREDICTIONS;
}

/** Pronóstico del usuario en la liga activa, sacado de los suyos (`/predictions/mine`). */
export function useMyLeaguePrediction(): PredictionSummary | undefined {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const { data } = useQuery(myPredictionsQuery(isAuthenticated));
  return useMemo(() => {
    if (!activeGroupId || !Array.isArray(data)) return undefined;
    return data.find((p) =>
      p.groupId != null ? String(p.groupId) === activeGroupId : isGlobalLeagueId(activeGroupId),
    );
  }, [data, activeGroupId]);
}
