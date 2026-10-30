import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
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
    vi.stubGlobal('WebSocket', FakeSocket);
    client = new QueryClient();
    invalidated = [];
    vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      invalidated.push([...(filters?.queryKey ?? [])]);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const send = (msg: object) => FakeSocket.last!.onmessage!({ data: JSON.stringify(msg) });

  it.each(['DATA_UPDATED', 'MATCH_SCORE_UPDATED'])(
    '%s invalida solo claves que existen, incluido el cuadro oficial',
    (type) => {
      renderHook(() => useWebSocket('Ana', client));
      send({ type, matchId: 1, homeScore: 1, awayScore: 0, status: 'IN_PLAY' });

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
    renderHook(() => useWebSocket('Ana', client));
    send({ type: 'LEAGUE_UPDATED', leagueId: 10 });

    expect(invalidated).toContainEqual(['leaderboard', '10']);
    expect(invalidated).toContainEqual(['groupMembers', '10']);
    expect(invalidated).toContainEqual(['predictions', '10']);
    expect(invalidated).toContainEqual(['myGroups']);
    // Nada global: ni otras ligas ni partidos, clasificaciones o cuadro oficial.
    expect(invalidated).not.toContainEqual(['leaderboard']);
    expect(invalidated).not.toContainEqual(['matches']);
    expect(invalidated).not.toContainEqual(['standings']);
    expect(invalidated).not.toContainEqual(['officialBracket']);
  });

  it('actualiza el marcador en la caché de partidos', () => {
    client.setQueryData(['matches', 2], [{ id: 1, homeScore: 0, awayScore: 0 }]);
    renderHook(() => useWebSocket('Ana', client));
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
});
