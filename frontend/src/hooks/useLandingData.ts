import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCompetitions, fetchLeaderboard, fetchMatches } from '../services/api';
import { leaguePredictionsQuery } from '../services/queries';
import { queryKeys } from '../services/queryKeys';
import { rankPicks, toBracketEntries } from '../utils/bracketStats';
import { GLOBAL_LEAGUE_ID } from '../utils/constants';
import type { Match } from '../types/api';
import type { StickerLeader } from '../components/StickerCard';

export type LandingLeader = StickerLeader;

export interface ChampionPick {
  team: string;
  count: number;
  total: number;
}

/**
 * Datos reales de la Porra Global para la portada: los primeros de la clasificación, el campeón
 * más elegido y los próximos partidos de LaLiga. Todo son lecturas públicas.
 */
export function useLandingData() {
  const leaderboard = useQuery({
    queryKey: queryKeys.leaderboard(GLOBAL_LEAGUE_ID),
    queryFn: () => fetchLeaderboard(GLOBAL_LEAGUE_ID),
    staleTime: 60_000,
    retry: 1,
  });
  const predictions = useQuery(leaguePredictionsQuery(GLOBAL_LEAGUE_ID));
  const competitions = useQuery({
    queryKey: queryKeys.competitions(),
    queryFn: fetchCompetitions,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const competitionId = competitions.data?.find((item) => item.externalId === 'esp.1')?.id;
  const fixtures = useQuery({
    queryKey: queryKeys.matches(competitionId ?? null),
    queryFn: () => (competitionId == null ? Promise.resolve([]) : fetchMatches(competitionId)),
    enabled: competitionId != null,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const leaders = useMemo<LandingLeader[]>(() => {
    const rows = [...(leaderboard.data ?? [])].sort((a, b) => b.total - a.total);
    return rows.slice(0, 5).map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      name: row.name,
      avatarUrl: row.avatarUrl,
      total: row.total,
    }));
  }, [leaderboard.data]);

  const champion = useMemo<ChampionPick | null>(() => {
    const entries = toBracketEntries(predictions.data ?? []);
    const [best] = rankPicks(entries, 'champion');
    return best ? { team: best.team, count: best.count, total: entries.length } : null;
  }, [predictions.data]);

  const nextFixtures = useMemo<Match[]>(() => nextRound(fixtures.data ?? []), [fixtures.data]);

  return {
    leaders,
    participants: leaderboard.data?.length ?? 0,
    champion,
    nextFixtures,
    loading: leaderboard.isPending,
    error: leaderboard.isError,
  };
}

/** Los tres primeros partidos de la próxima jornada que aún no ha empezado. */
export function nextRound(matches: Match[]): Match[] {
  const now = Date.now();
  const upcoming = matches
    .filter((m) => !m.finished && m.date && new Date(m.date).getTime() > now)
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!));
  const round = upcoming[0]?.round;
  if (!round) return [];
  return upcoming.filter((m) => m.round === round).slice(0, 3);
}
