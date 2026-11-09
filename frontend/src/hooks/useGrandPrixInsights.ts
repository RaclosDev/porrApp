import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { fetchGrandPrixBoard, fetchGrandPrixSeasonPicks } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import type { RaceDriver } from '../types/api';
import { closedRaces } from '../utils/grandPrixStats';

/**
 * Datos de Más elegidos y del Buscador en una liga de Fórmula 1: los Grandes Premios ya cerrados
 * con las predicciones de la liga. Los que siguen abiertos no llegan del servidor.
 */
export function useGrandPrixInsights() {
  const { activeGroupId, activeGroupName, userId } = useAppContext();
  const hasLeague = Boolean(activeGroupId);

  const board = useQuery({
    queryKey: queryKeys.grandPrix(activeGroupId, userId),
    queryFn: () => fetchGrandPrixBoard(activeGroupId),
    enabled: hasLeague,
    staleTime: 60_000,
  });
  const season = useQuery({
    queryKey: queryKeys.grandPrixSeasonPicks(activeGroupId),
    queryFn: () => fetchGrandPrixSeasonPicks(activeGroupId),
    enabled: hasLeague,
    staleTime: 60_000,
  });

  const drivers = useMemo(
    () => new Map<number, RaceDriver>((board.data?.drivers ?? []).map((d) => [d.id, d])),
    [board.data],
  );
  const races = useMemo(
    () => closedRaces(board.data?.grandsPrix ?? [], season.data ?? []),
    [board.data, season.data],
  );

  return {
    races,
    drivers,
    leagueName: activeGroupName,
    groupId: activeGroupId,
    hasLeague,
    loading: hasLeague && (board.isPending || season.isPending),
    error: board.isError || season.isError,
  };
}
