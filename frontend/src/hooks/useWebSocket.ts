import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Match } from '../types/api';

export function useWebSocket(userName: string, queryClient: QueryClient) {
  useEffect(() => {
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/api/ws';
    let ws: WebSocket | null = null;
    let wsPingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connectWebSocket = () => {
      if (disposed) return;
      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        wsPingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, 10000);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'DATA_UPDATED') {
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['leaderboardMatchdays'] });
            queryClient.invalidateQueries({ queryKey: ['predictions'] });
            queryClient.invalidateQueries({ queryKey: ['myPredictions'] });
            queryClient.invalidateQueries({ queryKey: ['standings'] });
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            queryClient.invalidateQueries({ queryKey: ['radar'] });
            queryClient.invalidateQueries({ queryKey: ['matchdayFixtures'] });
            queryClient.invalidateQueries({ queryKey: ['missingRoundUsers'] });
            queryClient.invalidateQueries({ queryKey: ['competitionStandings'] });
          } else if (msg.type === 'MATCH_SCORE_UPDATED') {
            if (msg.matchId) {
              queryClient.setQueriesData(
                { queryKey: ['matches'] },
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
            queryClient.invalidateQueries({ queryKey: ['radar'] });
            queryClient.invalidateQueries({ queryKey: ['matchRadar'] });
            queryClient.invalidateQueries({ queryKey: ['standings'] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['leaderboardMatchdays'] });
            queryClient.invalidateQueries({ queryKey: ['matchdayFixtures'] });
            queryClient.invalidateQueries({ queryKey: ['competitionStandings'] });
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (wsPingInterval) clearInterval(wsPingInterval);
        if (!disposed) reconnectTimer = setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (wsPingInterval) clearInterval(wsPingInterval);
    };
  }, [queryClient]);
}
