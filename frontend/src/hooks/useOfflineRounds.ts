import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  addTrackerRound,
  type Tracker,
  type TrackerRoundDraft,
} from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { useAppStore } from '../store/useAppStore';
import { errorMessage } from '../utils/errors';

interface PendingRound {
  key: string;
  round: TrackerRoundDraft;
  createdAt: number;
  problem?: string;
}

const prefix = (accountId: string, trackerId: number) =>
  `porrapp.tracker.${accountId}.${trackerId}.round.`;

function list(accountId: string, trackerId: number): PendingRound[] {
  const start = prefix(accountId, trackerId);
  const entries: PendingRound[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(start)) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '') as Omit<PendingRound, 'key'>;
      if (value.round.clientRequestId && value.round.sessionId) entries.push({ ...value, key });
    } catch {
      // El dato original permanece en el dispositivo para recuperarlo manualmente.
    }
  }
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

function save(entry: PendingRound): void {
  localStorage.setItem(
    entry.key,
    JSON.stringify({
      round: entry.round,
      createdAt: entry.createdAt,
      problem: entry.problem,
    }),
  );
}

function migrateLegacy(accountId: string, trackerId: number): void {
  const key = `porrapp.tracker.${trackerId}.pendingRounds`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const rounds = JSON.parse(raw) as TrackerRoundDraft[];
  if (!Array.isArray(rounds) || rounds.some((round) => !round.sessionId)) return;
  const migrationKey = `${key}.migrationIds`;
  const stored = localStorage.getItem(migrationKey);
  const ids = stored ? (JSON.parse(stored) as string[]) : rounds.map(() => crypto.randomUUID());
  if (ids.length !== rounds.length) return;
  if (!stored) localStorage.setItem(migrationKey, JSON.stringify(ids));
  rounds.forEach((round, index) => {
    const clientRequestId = ids[index];
    save({
      key: `${prefix(accountId, trackerId)}${clientRequestId}`,
      round: { ...round, clientRequestId },
      createdAt: Date.now() + index,
    });
  });
  localStorage.removeItem(key);
  localStorage.removeItem(migrationKey);
}

const isNetworkFailure = (reason: unknown) =>
  !navigator.onLine ||
  reason instanceof TypeError ||
  (reason instanceof Error && 'status' in reason && reason.status === 0);

/** Cada ronda se persiste antes de enviarse y conserva su identificador en todos los reintentos. */
export function useOfflineRounds(trackerId: number | undefined, leagueId: string) {
  const accountId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const flushing = useRef(false);

  const refresh = useCallback(() => {
    if (!trackerId || !accountId) return;
    const queued = list(accountId, trackerId);
    setPending(queued.length);
    setProblem(queued.find((entry) => entry.problem)?.problem ?? null);
  }, [accountId, trackerId]);

  const flush = useCallback(async () => {
    if (!trackerId || !accountId || flushing.current || !navigator.onLine) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const entry of list(accountId, trackerId)) {
        if (entry.problem) break;
        try {
          const next = await addTrackerRound(trackerId, entry.round);
          localStorage.removeItem(entry.key);
          if (useAppStore.getState().userId === accountId)
            queryClient.setQueryData(queryKeys.tracker(leagueId), next);
          sent++;
        } catch (reason) {
          if (!isNetworkFailure(reason)) {
            entry.problem = errorMessage(reason, 'La ronda necesita revisión');
            save(entry);
            toast.error(entry.problem);
          }
          break;
        }
      }
    } finally {
      flushing.current = false;
      refresh();
    }
    if (sent > 0) toast.success(sent === 1 ? 'Ronda sincronizada' : `${sent} rondas sincronizadas`);
  }, [trackerId, accountId, leagueId, queryClient, refresh]);

  useEffect(() => {
    if (!trackerId || !accountId) return;
    try {
      migrateLegacy(accountId, trackerId);
    } catch {
      toast.error('Hay rondas antiguas pendientes que no se pudieron trasladar');
    }
    refresh();
    void flush();
    const online = () => void flush();
    const changed = () => refresh();
    window.addEventListener('online', online);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('storage', changed);
    };
  }, [trackerId, accountId, flush, refresh]);

  const add = async (draft: TrackerRoundDraft): Promise<Tracker | 'queued'> => {
    if (!trackerId || !accountId || !draft.sessionId)
      throw new Error('Partida o cuenta sin cargar');
    const round = { ...draft, clientRequestId: crypto.randomUUID() };
    const entry: PendingRound = {
      key: `${prefix(accountId, trackerId)}${round.clientRequestId}`,
      round,
      createdAt: Date.now(),
    };
    try {
      save(entry);
    } catch {
      throw new Error('No queda espacio para guardar la ronda en este dispositivo');
    }
    refresh();
    if (!navigator.onLine || flushing.current || list(accountId, trackerId).length > 1) {
      toast('Ronda guardada en este dispositivo; se enviará al recuperar la conexión');
      void flush();
      return 'queued';
    }
    try {
      const next = await addTrackerRound(trackerId, round);
      localStorage.removeItem(entry.key);
      refresh();
      return next;
    } catch (reason) {
      if (isNetworkFailure(reason)) {
        toast('Ronda guardada en este dispositivo; se enviará al recuperar la conexión');
        return 'queued';
      }
      entry.problem = errorMessage(reason, 'La ronda necesita revisión');
      save(entry);
      refresh();
      throw reason;
    }
  };

  const retry = () => {
    if (!trackerId || !accountId) return;
    for (const entry of list(accountId, trackerId)) {
      if (entry.problem) save({ ...entry, problem: undefined });
    }
    refresh();
    void flush();
  };

  return { pending, problem, add, retry };
}
