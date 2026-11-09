import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INVALIDATION_JITTER_MS, useWebSocket } from '../../hooks/useWebSocket';

/** Tiempo tras el que se ha aplicado seguro cualquier invalidación diferida. */
const FLUSH_MS = 100 + INVALIDATION_JITTER_MS;

class FakeSocket {
  static last: FakeSocket | null = null;
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    FakeSocket.last = this;
  }
  send() {}
  close() {}
}

describe('useWebSocket', () => {
  let client: QueryClient;
  let invalidated: unknown[][];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    client = new QueryClient();
    invalidated = [];
    vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      invalidated.push([...(filters?.queryKey ?? [])]);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const send = (msg: object) => FakeSocket.last!.onmessage!({ data: JSON.stringify(msg) });

  it.each(['DATA_UPDATED', 'MATCH_SCORE_UPDATED'])(
    '%s invalida solo claves que existen, incluido el cuadro oficial',
    (type) => {
      renderHook(() => useWebSocket(client));
      send({ type, matchId: 1, homeScore: 1, awayScore: 0, status: 'IN_PLAY' });
      act(() => vi.advanceTimersByTime(FLUSH_MS));

      expect(invalidated).toContainEqual(['radar']);
      expect(invalidated).toContainEqual(['tournamentOfficialBracket']);
      expect(invalidated).toContainEqual(['matchFriendPredictions']);
      expect(invalidated).toContainEqual(['leaderboard']);
      // Los Grandes Premios de la Fórmula 1 llegan en segundo plano tras crear la liga.
      expect(invalidated).toContainEqual(['grandPrix']);
      for (const ghost of ['myPredictions', 'missingRoundUsers', 'matchRadar']) {
        expect(invalidated).not.toContainEqual([ghost]);
      }
    },
  );

  it('DATA_UPDATED de una competición que no sigo solo refresca las vistas de esa competición', () => {
    client.setQueryData(['myGroups', true], [{ id: 10, competitionId: 5 }]);
    renderHook(() => useWebSocket(client));
    send({ type: 'DATA_UPDATED', competitionIds: [8] });
    act(() => vi.advanceTimersByTime(FLUSH_MS));

    expect(invalidated).toContainEqual(['radar', 8]);
    expect(invalidated).toContainEqual(['matches', 8]);
    expect(invalidated).toContainEqual(['competitionStandings', 8]);
    expect(invalidated).not.toContainEqual(['leaderboard']);
    expect(invalidated).not.toContainEqual(['predictions']);
    expect(invalidated).not.toContainEqual(['radar']);
  });

  it('DATA_UPDATED de una competición de mis ligas, también de las añadidas, lo refresca todo', () => {
    client.setQueryData(
      ['myGroups', true],
      [{ id: 10, competitionId: 5, competitions: [{ id: 5 }, { id: 8 }] }],
    );
    renderHook(() => useWebSocket(client));
    send({ type: 'DATA_UPDATED', competitionIds: [8, 9] });
    act(() => vi.advanceTimersByTime(FLUSH_MS));

    expect(invalidated).toContainEqual(['leaderboard']);
    expect(invalidated).toContainEqual(['radar']);
  });

  it('DATA_UPDATED con competiciones lo refresca todo si aún no hay ligas cargadas o la liga abierta la juega', () => {
    const { unmount } = renderHook(() => useWebSocket(client));
    send({ type: 'DATA_UPDATED', competitionIds: [8] });
    act(() => vi.advanceTimersByTime(FLUSH_MS));
    expect(invalidated).toContainEqual(['leaderboard']);
    unmount();

    invalidated.length = 0;
    client.setQueryData(['myGroups', true], [{ id: 10, competitionId: 5 }]);
    client.setQueryData(['group', '77'], { id: 77, competitionId: 8 });
    renderHook(() => useWebSocket(client));
    send({ type: 'DATA_UPDATED', competitionIds: [8] });
    act(() => vi.advanceTimersByTime(FLUSH_MS));
    expect(invalidated).toContainEqual(['leaderboard']);
  });

  it('CLOCK_UPDATED de una competición que no sigo solo refresca sus partidos y su radar', () => {
    client.setQueryData(['myGroups', true], [{ id: 10, competitionId: 5 }]);
    renderHook(() => useWebSocket(client));
    send({ type: 'CLOCK_UPDATED', competitionIds: [8] });
    act(() => vi.advanceTimersByTime(FLUSH_MS));

    expect(invalidated).toEqual(
      expect.arrayContaining([
        ['matches', 8],
        ['radar', 8],
      ]),
    );
    expect(invalidated).toHaveLength(2);
  });

  it('LEAGUE_UPDATED invalida solo las consultas de esa liga', () => {
    client.setQueryData(['myGroups', true], [{ id: 10 }]);
    renderHook(() => useWebSocket(client));
    send({ type: 'LEAGUE_UPDATED', leagueId: 10 });
    act(() => vi.advanceTimersByTime(FLUSH_MS));

    expect(invalidated).toContainEqual(['leaderboard', '10']);
    expect(invalidated).toContainEqual(['groupMembers', '10']);
    expect(invalidated).toContainEqual(['predictions', '10']);
    expect(invalidated).toContainEqual(['myPredictions']);
    expect(invalidated).toContainEqual(['myGroups']);
    // Nada global: ni otras ligas ni partidos, clasificaciones o cuadro oficial.
    expect(invalidated).not.toContainEqual(['leaderboard']);
    expect(invalidated).not.toContainEqual(['matches']);
    expect(invalidated).not.toContainEqual(['tournamentStandings']);
    expect(invalidated).not.toContainEqual(['tournamentOfficialBracket']);
  });

  it('LEAGUE_UPDATED de una liga ajena no recarga Mis ligas ni mis predicciones', () => {
    client.setQueryData(['myGroups', true], [{ id: 10 }]);
    renderHook(() => useWebSocket(client));
    send({ type: 'LEAGUE_UPDATED', leagueId: 99 });
    act(() => vi.advanceTimersByTime(FLUSH_MS));

    expect(invalidated).toContainEqual(['leaderboard', '99']);
    expect(invalidated).not.toContainEqual(['myGroups']);
    expect(invalidated).not.toContainEqual(['myPredictions']);
  });

  it('TRACKER_UPDATED recarga los marcadores al instante, sin el retraso aleatorio', () => {
    renderHook(() => useWebSocket(client));
    send({ type: 'TRACKER_UPDATED', trackerId: 7 });

    expect(invalidated).toEqual([['trackers']]);
  });

  it('CLOCK_UPDATED solo vuelve a pedir partidos y radar, y no al instante', () => {
    renderHook(() => useWebSocket(client));
    send({ type: 'CLOCK_UPDATED' });
    expect(invalidated).toHaveLength(0);
    act(() => vi.advanceTimersByTime(FLUSH_MS));

    expect(invalidated).toEqual(expect.arrayContaining([['matches'], ['radar']]));
    expect(invalidated).toHaveLength(2);
  });

  it('actualiza el marcador en la caché de partidos', () => {
    client.setQueryData(['matches', 2], [{ id: 1, homeScore: 0, awayScore: 0 }]);
    renderHook(() => useWebSocket(client));
    send({
      type: 'MATCH_SCORE_UPDATED',
      matchId: 1,
      homeScore: 2,
      awayScore: 1,
      status: 'FINISHED',
    });
    expect(client.getQueryData(['matches', 2])).toEqual([
      expect.objectContaining({ homeScore: 2, awayScore: 1, finished: true }),
    ]);
  });

  it('deduplicates mixed score/data events and cancels pending work on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket(client));
    send({ type: 'MATCH_SCORE_UPDATED', matchId: 1 });
    send({ type: 'DATA_UPDATED' });
    act(() => vi.advanceTimersByTime(FLUSH_MS));
    expect(invalidated.filter((key) => key[0] === 'radar')).toHaveLength(1);
    expect(invalidated.filter((key) => key[0] === 'matches')).toHaveLength(1);
    const before = invalidated.length;
    send({ type: 'DATA_UPDATED' });
    const lateOpen = FakeSocket.last!.onopen!;
    const lateMessage = FakeSocket.last!.onmessage!;
    unmount();
    act(() => {
      lateOpen();
      lateMessage({ data: JSON.stringify({ type: 'LEAGUE_UPDATED', leagueId: 10 }) });
      vi.advanceTimersByTime(20000);
    });
    expect(invalidated).toHaveLength(before);
  });
});

describe('WebSocket recovery with active queries', () => {
  let client: QueryClient;
  const unsubscribe: (() => void)[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    unsubscribe.splice(0).forEach((stop) => stop());
    client.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconciles stale active queries after reconnecting without receiving a new event', async () => {
    const queries = ['leaderboard', 'radar', 'groupMembers', 'matches'].map((key) => {
      const queryFn = vi.fn().mockResolvedValue(['fresh']);
      const observer = new QueryObserver(client, {
        queryKey: [key, '10'],
        queryFn,
        initialData: ['old'],
        staleTime: 0,
        refetchOnMount: false,
      });
      unsubscribe.push(observer.subscribe(() => {}));
      return queryFn;
    });
    const { unmount } = renderHook(() => useWebSocket(client));
    const old = FakeSocket.last!;
    act(() => old.onopen!());
    expect(queries.every((fn) => fn.mock.calls.length === 0)).toBe(true);
    act(() => old.onclose!());
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(FakeSocket.last).not.toBe(old);
    await act(async () => FakeSocket.last!.onopen!());
    queries.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
    await act(async () => FakeSocket.last!.onmessage!({ data: JSON.stringify({ type: 'PONG' }) }));
    queries.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
    unmount();
    const last = FakeSocket.last;
    await vi.advanceTimersByTimeAsync(20000);
    expect(FakeSocket.last).toBe(last);
  });

  it('measures query work during a burst of 50 score events', async () => {
    let requests = 0;
    let cancellations = 0;
    for (const key of ['leaderboard', 'radar', 'matchdayStats']) {
      const observer = new QueryObserver(client, {
        queryKey: [key, '10'],
        initialData: [],
        staleTime: Infinity,
        queryFn: ({ signal }) => {
          requests++;
          signal.addEventListener('abort', () => cancellations++);
          return new Promise<string[]>(() => {});
        },
      });
      unsubscribe.push(observer.subscribe(() => {}));
    }
    const { unmount } = renderHook(() => useWebSocket(client));
    client.setQueryData(['matches', 2], [{ id: 1, homeScore: 0 }]);
    for (let i = 0; i < 50; i++)
      act(() =>
        FakeSocket.last!.onmessage!({
          data: JSON.stringify({
            type: 'MATCH_SCORE_UPDATED',
            matchId: 1,
            homeScore: i,
            awayScore: 0,
            status: 'IN_PLAY',
          }),
        }),
      );
    expect(client.getQueryData(['matches', 2])).toEqual([
      expect.objectContaining({ homeScore: 49 }),
    ]);
    expect(requests).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(FLUSH_MS));
    expect(requests).toBe(3);
    expect(cancellations).toBe(0);
    unmount();
  });
});
