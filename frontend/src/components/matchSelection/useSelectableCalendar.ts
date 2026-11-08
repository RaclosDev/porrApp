import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSelectableMatchesOf } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import { isImporting } from './matchSelection';

/** Cada cuánto se vuelve a pedir el calendario mientras el servidor carga una competición de ESPN. */
export const IMPORT_POLL_MS = 3000;

/**
 * Calendario de las competiciones de una liga (la principal primero) para elegir sus partidos. Al
 * añadir o quitar una competición se sigue viendo el anterior mientras llega el nuevo. Una competición
 * que nunca se había cargado la importa el servidor en ese momento: se vuelve a pedir hasta que llega.
 */
export function useSelectableCalendar(competitionIds: number[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.selectableMatches(competitionIds),
    queryFn: () => fetchSelectableMatchesOf(competitionIds),
    enabled: enabled && competitionIds.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (isImporting(query.state.data) ? IMPORT_POLL_MS : false),
  });
}
