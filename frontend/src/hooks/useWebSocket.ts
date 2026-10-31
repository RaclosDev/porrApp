import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Match } from '../types/api';
import { queryKeys } from '../services/queryKeys';

/** Consultas que cambian cuando cambia un resultado. */
const SCORE_DEPENDENT_KEYS = [
  queryKeys.radar(),
  queryKeys.standings(),
  queryKeys.leaderboard(),
  queryKeys.leaderboardMatchdays(),
  queryKeys.matchdayFixtures(),
  queryKeys.matchFriendPredictions(),
  queryKeys.matchdayStats(),
  queryKeys.competitionStandings(),
  queryKeys.officialBracket(),
  queryKeys.predictionScore(),
];

const DATA_DEPENDENT_KEYS = [
  ...SCORE_DEPENDENT_KEYS,
  queryKeys.predictions(),
  queryKeys.matches(),
  queryKeys.topScorers(),
];

const RECONNECT_KEYS = [
  ...DATA_DEPENDENT_KEYS,
  queryKeys.odds(),
  queryKeys.group(),
  queryKeys.groupMembers(),
  queryKeys.leagueScoring(),
  queryKeys.myPredictions(),
  queryKeys.myGroups(),
];

/** Consultas de una liga concreta: solo se vuelven a pedir si están en pantalla. */
const leagueKeys = (leagueId: string | number) => [
  queryKeys.group(leagueId),
  queryKeys.groupMembers(leagueId),
  queryKeys.leagueScoring(leagueId),
  queryKeys.predictions(leagueId),
  // El aviso no dice de quién es el cambio: puede ser la porra propia (o su borrado).
  queryKeys.myPredictions(),
  queryKeys.leaderboard(leagueId),
  queryKeys.leaderboardMatchdays(leagueId),
  queryKeys.matchdayFixtures(leagueId),
  queryKeys.matchFriendPredictions(leagueId),
  queryKeys.matchdayStats(leagueId),
  queryKeys.predictionScore(),
  // Las tarjetas de "Mis ligas" muestran miembros e imagen.
  queryKeys.myGroups(),
];

const invalidateAll = (queryClient: QueryClient, keys: readonly (readonly unknown[])[]) => {
  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
};

export function useWebSocket(userName: string, queryClient: QueryClient) {
  useEffect(() => {
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/api/ws';
    let ws: WebSocket | null = null;
    let wsPingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingInvalidations = new Map<string, readonly unknown[]>();
    let disconnected = false;
    let disposed = false;

    const queueInvalidations = (keys: readonly (readonly unknown[])[]) => {
      keys.forEach((key) => pendingInvalidations.set(JSON.stringify(key), key));
      if (invalidationTimer !== null) return;
      invalidationTimer = setTimeout(() => {
        invalidationTimer = null;
        invalidateAll(queryClient, [...pendingInvalidations.values()]);
        pendingInvalidations.clear();
      }, 100);
    };

    const connectWebSocket = () => {
      if (disposed) return;
      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        if (disposed || socket !== ws) return;
        if (disconnected) {
          if (invalidationTimer !== null) clearTimeout(invalidationTimer);
          invalidationTimer = null;
          pendingInvalidations.clear();
          invalidateAll(queryClient, RECONNECT_KEYS);
          disconnected = false;
        }
        wsPingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, 10000);
      };

      socket.onmessage = (event) => {
        if (disposed || socket !== ws) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'DATA_UPDATED') {
            queueInvalidations(DATA_DEPENDENT_KEYS);
          } else if (msg.type === 'LEAGUE_UPDATED') {
            if (msg.leagueId != null) invalidateAll(queryClient, leagueKeys(msg.leagueId));
          } else if (msg.type === 'MATCH_SCORE_UPDATED') {
            if (msg.matchId) {
              queryClient.setQueriesData(
                { queryKey: queryKeys.matches() },
                (oldMatches: Match[] | undefined) => {
                  if (!Array.isArray(oldMatches)) return oldMatches;
                  return oldMatches.map((m) =>
                    m.id === msg.matchId
                      ? {
                          ...m,
                          homeScore: msg.homeScore,
                          awayScore: msg.awayScore,
                          home_score: msg.homeScore,
                          away_score: msg.awayScore,
                          finished: msg.status === 'FINISHED',
                          status: msg.status,
                        }
                      : m,
                  );
                },
              );
            }
            queueInvalidations(SCORE_DEPENDENT_KEYS);
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (disposed || socket !== ws) return;
        disconnected = true;
        if (wsPingInterval) clearInterval(wsPingInterval);
        if (!disposed) reconnectTimer = setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (invalidationTimer !== null) clearTimeout(invalidationTimer);
      pendingInvalidations.clear();
      if (ws) {
        ws.onclose = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.close();
      }
      if (wsPingInterval) clearInterval(wsPingInterval);
    };
  }, [queryClient]);
}
