import { useEffect } from 'react';

export function useWebSocket(userName, queryClient) {
  useEffect(() => {
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/api/ws';
    let ws = null;
    let wsPingInterval = null;
    let reconnectTimer = null;
    let disposed = false;

    const connectWebSocket = () => {
      if (disposed) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wsPingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'DATA_UPDATED') {
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
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
              queryClient.setQueriesData({ queryKey: ['matches'] }, (oldMatches) => {
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
              });
            }
            queryClient.invalidateQueries({ queryKey: ['radar'] });
            queryClient.invalidateQueries({ queryKey: ['matchRadar'] });
            queryClient.invalidateQueries({ queryKey: ['standings'] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['matchdayFixtures'] });
            queryClient.invalidateQueries({ queryKey: ['competitionStandings'] });
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onclose = () => {
        clearInterval(wsPingInterval);
        if (!disposed) reconnectTimer = setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      clearInterval(wsPingInterval);
    };
  }, [queryClient]);
}
