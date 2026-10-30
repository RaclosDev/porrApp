import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { fetchPredictions } from '../services/api';
import { officialBracketQuery } from '../services/queries';
import { queryKeys } from '../services/queryKeys';
import { buildOfficialState, toBracketEntries } from '../utils/bracketStats';

/**
 * Datos de Más elegidos y del Buscador en una liga de cuadro: los cuadros visibles de la liga
 * y el estado real del torneo para compararlos.
 */
export function useBracketInsights() {
  const {
    activeGroupId,
    activeGroupName,
    activeGroupPoolFormat,
    activeGroupPichichi,
    activeGroupLockDate,
    officialPoints,
    leaderboardData,
    setViewerPredictionId,
  } = useAppContext();

  // Misma consulta que AppContext (comparten caché); aquí hace falta saber si sigue cargando.
  const predictions = useQuery({
    queryKey: queryKeys.predictions(activeGroupId),
    queryFn: () => fetchPredictions(activeGroupId),
    enabled: Boolean(activeGroupId),
    retry: 1,
  });
  const official = useQuery(officialBracketQuery());

  const summaries = useMemo(() => predictions.data ?? [], [predictions.data]);
  const entries = useMemo(() => toBracketEntries(summaries), [summaries]);
  const officialState = useMemo(
    () => buildOfficialState(official.data, officialPoints),
    [official.data, officialPoints],
  );

  // Los pronósticos no traen la foto; la clasificación de la liga sí.
  const avatarByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of leaderboardData) {
      if (row.userId !== null && row.avatarUrl) map.set(row.userId, row.avatarUrl);
    }
    return map;
  }, [leaderboardData]);

  return {
    entries,
    official: officialState,
    officialBracket: official.data,
    /** Cuadros enviados cuyo contenido aún no se ve (la liga no ha cerrado). */
    hiddenCount: summaries.filter((p) => p.data == null).length,
    loading: Boolean(activeGroupId) && (predictions.isPending || official.isPending),
    error: predictions.isError,
    hasLeague: Boolean(activeGroupId),
    leagueName: activeGroupName,
    knockoutsOnly: activeGroupPoolFormat === 'KNOCKOUTS_ONLY',
    pichichi: activeGroupPichichi,
    lockDate: activeGroupLockDate,
    avatarByUserId,
    openPrediction: setViewerPredictionId,
  };
}
