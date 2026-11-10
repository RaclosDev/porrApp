import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  addTrackerRound,
  type Tracker,
  type TrackerRoundDraft,
} from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';

const storageKey = (trackerId: number) => `porrapp.tracker.${trackerId}.pendingRounds`;

const read = (trackerId: number): TrackerRoundDraft[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(trackerId)) ?? '[]');
    return Array.isArray(parsed) ? (parsed as TrackerRoundDraft[]) : [];
  } catch {
    return [];
  }
};

const write = (trackerId: number, rounds: TrackerRoundDraft[]) => {
  try {
    if (rounds.length === 0) localStorage.removeItem(storageKey(trackerId));
    else localStorage.setItem(storageKey(trackerId), JSON.stringify(rounds));
  } catch {
    // Sin almacenamiento no se puede guardar para luego; la ronda se pierde como antes.
  }
};

/** Sin red el envío no llega ni a salir: fetch falla con TypeError. */
const isNetworkFailure = (reason: unknown) => !navigator.onLine || reason instanceof TypeError;

/**
 * Rondas apuntadas sin conexión: se guardan en el móvil y se envían en orden al volver la red, para
 * que una mesa sin cobertura pueda seguir apuntando.
 */
export function useOfflineRounds(trackerId: number | undefined, leagueId: string) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (trackerId == null || flushing.current || !navigator.onLine) return;
    flushing.current = true;
    let sent = 0;
    try {
      let queue = read(trackerId);
      while (queue.length > 0) {
        const [round, ...rest] = queue;
        let next: Tracker | null = null;
        try {
          next = await addTrackerRound(trackerId, round);
        } catch (reason) {
          if (isNetworkFailure(reason)) break;
          toast.error(errorMessage(reason, 'Una ronda guardada sin conexión no se pudo apuntar'));
        }
        if (next) {
          queryClient.setQueryData(queryKeys.tracker(leagueId), next);
          sent += 1;
        }
        queue = rest;
        write(trackerId, queue);
      }
    } finally {
      flushing.current = false;
      setPending(read(trackerId).length);
    }
    if (sent > 0)
      toast.success(
        sent === 1 ? 'Ronda sin conexión enviada' : `${sent} rondas sin conexión enviadas`,
      );
  }, [trackerId, leagueId, queryClient]);

  useEffect(() => {
    if (trackerId == null) return;
    setPending(read(trackerId).length);
    void flush();
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [trackerId, flush]);

  /**
   * Envía la ronda; si no hay red la deja guardada. Devuelve la liga nueva, `'queued'` si quedó para
   * luego o lanza el error si el servidor la rechazó.
   */
  const add = async (round: TrackerRoundDraft): Promise<Tracker | 'queued'> => {
    if (trackerId == null) throw new Error('Liga sin cargar');
    const queue = () => {
      write(trackerId, [...read(trackerId), round]);
      setPending(read(trackerId).length);
      toast('Sin conexión: la ronda se enviará al volver la red');
      void flush();
      return 'queued' as const;
    };
    if (!navigator.onLine || read(trackerId).length > 0) return queue();
    try {
      return await addTrackerRound(trackerId, round);
    } catch (reason) {
      if (isNetworkFailure(reason)) return queue();
      throw reason;
    }
  };

  return { pending, add };
}
