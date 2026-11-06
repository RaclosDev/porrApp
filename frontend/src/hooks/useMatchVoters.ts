import { useQuery } from '@tanstack/react-query';
import { fetchMatchVoters } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import type { MatchVoters } from '../types/api';

/** Máximo que acepta el servidor por petición. */
const MAX_MATCHES = 60;

/**
 * Votantes de cada signo de los partidos cerrados de una liga, por id de partido. Solo pide los
 * partidos que ya se han cerrado: los abiertos siguen ocultos.
 */
export function useMatchVoters(
  groupId: string | number | null | undefined,
  lockedMatchIds: number[],
): Map<number, MatchVoters> {
  const ids = [...new Set(lockedMatchIds)].sort((a, b) => a - b).slice(0, MAX_MATCHES);
  const idsKey = ids.join(',');
  const { data } = useQuery({
    queryKey: queryKeys.matchVoters(groupId ?? null, idsKey),
    queryFn: () => fetchMatchVoters(groupId!, ids),
    enabled: groupId != null && groupId !== '' && ids.length > 0,
    staleTime: 60_000,
  });
  return new Map((data ?? []).map((voters) => [voters.matchId, voters]));
}
