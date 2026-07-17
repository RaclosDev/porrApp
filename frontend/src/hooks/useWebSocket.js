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
                console.log('WebSocket connected');
                const name = userName || localStorage.getItem('my_bet_name') || "Anónimo";
                ws.send(JSON.stringify({ type: 'HEARTBEAT', name }));
                
                wsPingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'PING' }));
                        queryClient.invalidateQueries({ queryKey: ['presence'] });
                    }
                }, 10000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'DATA_UPDATED') {
                        queryClient.invalidateQueries();
                    } else if (msg.type === 'PRESENCE_UPDATED') {
                        queryClient.invalidateQueries({ queryKey: ['presence'] });
                    }
                } catch {
                    // ignore
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected, reconnecting in 5s...');
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
