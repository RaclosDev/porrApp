import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { leaguePredictionsQuery } from '../services/queries';
import { fieldFromDraw, fieldFromMatches, toKnockoutEntries } from '../utils/knockoutStats';
import { logosOf } from '../utils/knockoutDraw';
import { isNbaCompetition } from '../utils/nbaPlayoffs';
import { useCustomBracketData } from './useCustomBracketData';
import { useCustomLock } from './useCustomLock';

/**
 * Datos de Más elegidos y del Buscador en unas eliminatorias sorteadas o en un cuadro propio: las
 * elecciones ya cerradas de la liga y el cuadro real de esa competición para compararlas.
 */
export function useKnockoutInsights() {
  const {
    leagueKind,
    activeGroupId,
    activeGroupName,
    activeGroupCustomCompetition,
    activeCompetitionExternalId,
    allGames,
    leaderboardData,
    setViewerPredictionId,
  } = useAppContext();
  const hasLeague = Boolean(activeGroupId);
  const drawn = leagueKind === 'knockoutDraw';
  const official = !activeGroupCustomCompetition;

  const predictions = useQuery(leaguePredictionsQuery(activeGroupId));
  const lock = useCustomLock(activeGroupId);
  const bracket = useCustomBracketData(activeGroupId, official, allGames);

  const knockoutRounds = lock.state?.knockoutRounds;
  const field = useMemo(
    () =>
      drawn
        ? fieldFromDraw(knockoutRounds ?? [], isNbaCompetition(activeCompetitionExternalId))
        : fieldFromMatches(bracket.matches, official),
    [drawn, knockoutRounds, activeCompetitionExternalId, bracket.matches, official],
  );
  const entries = useMemo(
    () => toKnockoutEntries(predictions.data ?? [], lock.state),
    [predictions.data, lock.state],
  );
  const logos = useMemo(
    () => (official ? logosOf(allGames) : bracket.logos),
    [official, allGames, bracket.logos],
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
    field,
    logos,
    /** Predicciones enviadas, se vea ya algo de ellas o no. */
    sentCount: predictions.data?.length ?? 0,
    nextLockAt: lock.state?.nextLockAt ?? null,
    loading: hasLeague && (predictions.isPending || !lock.state || bracket.loading),
    error: predictions.isError || Boolean(bracket.error),
    hasLeague,
    groupId: activeGroupId,
    leagueName: activeGroupName,
    avatarByUserId,
    openPrediction: setViewerPredictionId,
  };
}
