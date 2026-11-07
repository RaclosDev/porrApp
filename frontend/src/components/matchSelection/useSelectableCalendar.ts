import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSelectableMatchesOf } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';

/**
 * Calendario de las competiciones de una liga (la principal primero) para elegir sus partidos. Al
 * añadir o quitar una competición se sigue viendo el anterior mientras llega el nuevo.
 */
export function useSelectableCalendar(competitionIds: number[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.selectableMatches(competitionIds),
    queryFn: () => fetchSelectableMatchesOf(competitionIds),
    enabled: enabled && competitionIds.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
