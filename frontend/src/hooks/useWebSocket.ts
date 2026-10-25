import { useEffect } from 'react';

export function useWebSocket(userName, queryClient) {
  useEffect(() => {
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/api/ws';
    let ws = null;
    let wsPingInterval = null;

    const connectWebSocket = () => {
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
          } else if (msg.type === 'MATCH_SCORE_UPDATED') {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            queryClient.invalidateQueries({ queryKey: ['matchRadar'] });
            queryClient.invalidateQueries({ queryKey: ['standings'] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onclose = () => {
        clearInterval(wsPingInterval);
        setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      clearInterval(wsPingInterval);
    };
  }, [userName, queryClient]);
}
