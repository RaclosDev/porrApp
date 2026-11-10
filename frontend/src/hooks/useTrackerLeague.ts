import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchTracker, type Tracker } from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';

/**
 * Datos de una liga de juegos de mesa, compartidos por su inicio, la partida, el ranking y el
 * histórico. `change` ejecuta un cambio y deja la liga devuelta como la visible en todas.
 */
export function useTrackerLeague(leagueId: string | null) {
  const id = leagueId ?? '';
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.tracker(id),
    queryFn: () => fetchTracker(id),
    retry: false,
  });

  const change = async (action: () => Promise<Tracker>, failure: string) => {
    setBusy(true);
    try {
      const next = await action();
      queryClient.setQueryData(queryKeys.tracker(id), next);
      return next;
    } catch (reason) {
      toast.error(errorMessage(reason, failure));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { id, query, tracker: query.data, busy, change };
}
