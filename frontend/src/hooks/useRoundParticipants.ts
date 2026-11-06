import { useQuery } from '@tanstack/react-query';
import { fetchRoundParticipants } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import type { MatchVoter } from '../types/api';

/** Máximo que acepta el servidor por petición. */
const MAX_MATCHES = 60;

/**
 * Miembros de la liga que ya han hecho su predicción en alguno de los partidos de la jornada. Solo
 * dice quién ha participado: las predicciones siguen ocultas hasta el cierre.
 */
export function useRoundParticipants(
  groupId: string | number | null | undefined,
  matchIds: number[],
  enabled = true,
): MatchVoter[] {
  const ids = [...new Set(matchIds)].sort((a, b) => a - b).slice(0, MAX_MATCHES);
  const idsKey = ids.join(',');
  const { data } = useQuery({
    queryKey: queryKeys.roundParticipants(groupId ?? null, idsKey),
    queryFn: () => fetchRoundParticipants(groupId!, ids),
    enabled: enabled && groupId != null && groupId !== '' && ids.length > 0,
    staleTime: 60_000,
  });
  return data ?? [];
}
