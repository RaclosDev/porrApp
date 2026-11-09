import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTournamentData } from '../context/leagueData';
import { useAppContext } from '../context/AppContext';
import { leaguePredictionsQuery, tournamentOfficialBracketQuery } from '../services/queries';
import { groupStageTournament, toGroupStageEntries } from '../utils/groupStageBracket';

/**
 * Datos de Más elegidos y del Buscador en un torneo con fase de grupos (el Mundial): las
 * predicciones de la liga leídas como un cuadro genérico y el torneo real para compararlas. Tiene
 * la misma forma que `useKnockoutInsights`, más lo propio de la fase de grupos.
 */
export function useGroupStageInsights() {
  const {
    activeGroupId,
    activeGroupName,
    activeGroupPoolFormat,
    activeGroupPichichi,
    activeGroupLockDate,
    leaderboardData,
    setViewerPredictionId,
  } = useAppContext();
  const { groupStandings, tournamentId } = useTournamentData();
  const hasLeague = Boolean(activeGroupId);
  const knockoutsOnly = activeGroupPoolFormat === 'KNOCKOUTS_ONLY';

  const predictions = useQuery(leaguePredictionsQuery(activeGroupId));
  const official = useQuery(tournamentOfficialBracketQuery(tournamentId));

  // Antes del cierre solo llega entera la predicción propia: con eso no hay nada que comparar.
  const hidden = (predictions.data ?? []).some((prediction) => prediction.data == null);
  const entries = useMemo(
    () => (hidden ? [] : toGroupStageEntries(predictions.data ?? [], knockoutsOnly)),
    [hidden, predictions.data, knockoutsOnly],
  );
  const tournament = useMemo(
    () => groupStageTournament(official.data, groupStandings, knockoutsOnly),
    [official.data, groupStandings, knockoutsOnly],
  );

  // Las predicciones no traen la foto; la clasificación de la liga sí.
  const avatarByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of leaderboardData) {
      if (row.userId !== null && row.avatarUrl) map.set(row.userId, row.avatarUrl);
    }
    return map;
  }, [leaderboardData]);

  return {
    entries,
    field: tournament.field,
    tournament,
    officialBracket: official.data,
    /** Predicciones enviadas, se vean ya o no. */
    sentCount: predictions.data?.length ?? 0,
    nextLockAt: hidden ? activeGroupLockDate : null,
    loading: hasLeague && (predictions.isPending || official.isPending),
    error: predictions.isError,
    hasLeague,
    groupId: activeGroupId,
    leagueName: activeGroupName,
    knockoutsOnly,
    pichichi: activeGroupPichichi,
    avatarByUserId,
    openPrediction: setViewerPredictionId,
  };
}
