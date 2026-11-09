import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignScorerPick,
  fetchCompetitionPlayers,
  fetchScorerPicks,
  fetchScorerPickState,
  saveScorerPick,
} from '../services/api';
import { queryKeys } from '../services/queryKeys';
import type { ScorerCandidate, ScorerPickState, ScorerPickView } from '../types/api';

const EMPTY_PLAYERS: ScorerCandidate[] = [];
const EMPTY_PICKS: ScorerPickView[] = [];

/** Jugadores de la competición entre los que elegir; vacío mientras el proveedor no los da. */
export function useCompetitionPlayers(competitionId: number | null, enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.competitionPlayers(competitionId),
    queryFn: () => fetchCompetitionPlayers(competitionId as number),
    enabled: enabled && competitionId != null,
    staleTime: 600_000,
    retry: 1,
  });
  return { players: query.data ?? EMPTY_PLAYERS, loading: query.isLoading };
}

/** Pichichi propio de la liga (con su plazo) y, para quien la administra, el de todos. */
export function useScorerPick(groupId: number | string | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const active = enabled && groupId != null;
  const stateQuery = useQuery({
    queryKey: queryKeys.scorerPick(groupId),
    queryFn: () => fetchScorerPickState(groupId as number | string),
    enabled: active,
    staleTime: 30_000,
    retry: 1,
  });
  const state: ScorerPickState | null = stateQuery.data ?? null;
  const showPicks = Boolean(state?.enabled && (state.locked || state.canResolve));
  const picksQuery = useQuery({
    queryKey: queryKeys.scorerPicks(groupId as number | string),
    queryFn: () => fetchScorerPicks(groupId as number | string),
    enabled: active && showPicks,
    staleTime: 30_000,
    retry: 1,
  });

  const refreshPoints = () =>
    [queryKeys.leaderboard(groupId), queryKeys.leaderboardMatchdays(groupId)].forEach((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    );

  const save = useMutation({
    mutationFn: (pick: { name: string; playerId: string | null }) =>
      saveScorerPick(groupId as number | string, pick),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.scorerPick(groupId), saved);
      refreshPoints();
    },
  });

  const assign = useMutation({
    mutationFn: ({ predictionId, playerId }: { predictionId: number; playerId: string | null }) =>
      assignScorerPick(groupId as number | string, predictionId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scorerPick(groupId) });
      refreshPoints();
    },
  });

  return {
    state,
    loading: stateQuery.isLoading,
    error: stateQuery.error,
    picks: picksQuery.data ?? EMPTY_PICKS,
    picksLoading: picksQuery.isLoading,
    save,
    assign,
  };
}
