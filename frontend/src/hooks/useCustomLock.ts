import { useQuery } from '@tanstack/react-query';
import { fetchCustomLockState } from '../services/api';
import { queryKeys } from '../services/queryKeys';

/**
 * Estado del cierre de una competición personalizada. En los modos por ronda y por partido se
 * cierra por partes, así que se vuelve a pedir cada minuto mientras quede algo abierto.
 */
export function useCustomLock(groupId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: queryKeys.customLockState(groupId ?? undefined),
    queryFn: () => fetchCustomLockState(Number(groupId)),
    enabled: Boolean(groupId),
    refetchInterval: (query) => (query.state.data?.fullyLocked ? false : 60_000),
  });
  const progressive = data?.mode === 'PER_ROUND' || data?.mode === 'PER_MATCH';
  return {
    state: data,
    /** Ya hay una regla de cierre: fecha fija, primer partido con fecha o cierre por partes. */
    configured: Boolean(data && (progressive || data.lockDate)),
    progressive,
    anyLocked: Boolean(data?.anyLocked),
    fullyLocked: Boolean(data?.fullyLocked),
    groupLocked: (group: string) => Boolean(data?.lockedGroups.includes(group)),
    pickLocked: (round: number, index: number) => Boolean(data?.lockedPicks[round]?.[index]),
  };
}
