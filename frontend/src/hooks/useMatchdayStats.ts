import { useQuery } from '@tanstack/react-query';
import { fetchMatchdayStats } from '../services/api';
import { queryKeys } from '../services/queryKeys';

/** Estadísticas de los partidos ya empezados de una liga por jornadas. */
export function useMatchdayStats(groupId: string | number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matchdayStats(groupId ?? null),
    queryFn: () => fetchMatchdayStats(groupId!),
    enabled: groupId != null && groupId !== '',
    staleTime: 60_000,
  });
}
