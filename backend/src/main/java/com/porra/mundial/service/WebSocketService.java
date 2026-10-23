package com.porra.mundial.service;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Servicio WebSocket.
 * Mantiene la lista de clientes (Navegadores web) conectados en tiempo real.
 * Si ocurre un gol o un resultado cambia, emite eventos para actualizar sin recargar.
 */
@Service
@Slf4j
public class WebSocketService {

    private final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
    private final CacheManager cacheManager;

    public WebSocketService(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    public void addSession(WebSocketSession session) {
        sessions.add(session);
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
    }

    public void invalidateAndNotify() {
        Cache cache = cacheManager.getCache("leaderboard");
        if (cache != null) cache.clear();
        broadcastUpdate("DATA_UPDATED");
    }

    public void broadcastMatchScore(Long matchId, String homeTeam, String awayTeam, Integer homeScore, Integer awayScore, String status) {
        String json = String.format(
                "{\"type\":\"MATCH_SCORE_UPDATED\",\"matchId\":%d,\"homeTeam\":\"%s\",\"awayTeam\":\"%s\",\"homeScore\":%s,\"awayScore\":%s,\"status\":\"%s\"}",
                matchId != null ? matchId : 0L,
                homeTeam != null ? homeTeam.replace("\"", "\\\"") : "",
                awayTeam != null ? awayTeam.replace("\"", "\\\"") : "",
                homeScore != null ? homeScore : "null",
                awayScore != null ? awayScore : "null",
                status != null ? status : ""
        );
        broadcastRaw(json);
    }

    private void broadcastRaw(String jsonPayload) {
        TextMessage message = new TextMessage(jsonPayload);
        List<WebSocketSession> deadSessions = new java.util.ArrayList<>();
        for (WebSocketSession session : sessions) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(message);
                } else {
                    deadSessions.add(session);
                }
            } catch (IOException e) {
                deadSessions.add(session);
            }
        }
        sessions.removeAll(deadSessions);
    }

    public void broadcastUpdate(String eventType) {
        broadcastRaw("{\"type\": \"" + eventType + "\"}");
    }
}
