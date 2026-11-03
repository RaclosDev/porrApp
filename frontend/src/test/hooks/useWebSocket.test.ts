import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from '../../hooks/useWebSocket';

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
      act(() => vi.advanceTimersByTime(100));

      expect(invalidated).toContainEqual(['radar']);
      expect(invalidated).toContainEqual(['officialBracket']);
      expect(invalidated).toContainEqual(['matchFriendPredictions']);
      expect(invalidated).toContainEqual(['leaderboard']);
      for (const ghost of ['myPredictions', 'missingRoundUsers', 'matchRadar']) {
        expect(invalidated).not.toContainEqual([ghost]);
      }
    },
  );

  it('LEAGUE_UPDATED invalida solo las consultas de esa liga', () => {
    renderHook(() => useWebSocket(client));
    send({ type: 'LEAGUE_UPDATED', leagueId: 10 });

    expect(invalidated).toContainEqual(['leaderboard', '10']);
    expect(invalidated).toContainEqual(['groupMembers', '10']);
    expect(invalidated).toContainEqual(['predictions', '10']);
    expect(invalidated).toContainEqual(['myPredictions']);
    expect(invalidated).toContainEqual(['myGroups']);
    // Nada global: ni otras ligas ni partidos, clasificaciones o cuadro oficial.
    expect(invalidated).not.toContainEqual(['leaderboard']);
    expect(invalidated).not.toContainEqual(['matches']);
    expect(invalidated).not.toContainEqual(['standings']);
    expect(invalidated).not.toContainEqual(['officialBracket']);
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
    act(() => vi.advanceTimersByTime(100));
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
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(requests).toBe(3);
    expect(cancellations).toBe(0);
    unmount();
  });
});
