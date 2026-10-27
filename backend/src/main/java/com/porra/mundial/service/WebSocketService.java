package com.porra.mundial.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import lombok.extern.slf4j.Slf4j;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final ObjectMapper objectMapper;

    public WebSocketService(CacheManager cacheManager, ObjectMapper objectMapper) {
        this.cacheManager = cacheManager;
        this.objectMapper = objectMapper;
    }

    public void addSession(WebSocketSession session) {
        sessions.add(session);
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
    }

    public void invalidateAndNotify() {
        for (String cacheName : cacheManager.getCacheNames()) {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) cache.clear();
        }
        broadcastUpdate("DATA_UPDATED");
    }

    public void broadcastMatchScore(Long matchId, String homeTeam, String awayTeam, Integer homeScore, Integer awayScore, String status) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "MATCH_SCORE_UPDATED");
            payload.put("matchId", matchId != null ? matchId : 0L);
            payload.put("homeTeam", homeTeam != null ? homeTeam : "");
            payload.put("awayTeam", awayTeam != null ? awayTeam : "");
            payload.put("homeScore", homeScore);
            payload.put("awayScore", awayScore);
            payload.put("status", status != null ? status : "");
            broadcastRaw(objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.warn("Error serializando actualización de partido en WebSocket: {}", e.getMessage());
        }
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
        try {
            Map<String, String> payload = Map.of("type", eventType != null ? eventType : "DATA_UPDATED");
            broadcastRaw(objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.warn("Error serializando actualización en WebSocket: {}", e.getMessage());
        }
    }
}
