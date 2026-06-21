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

    /**
     * Invalida la caché del leaderboard y avisa a todos los clientes conectados.
     * Sustituye el patrón repetido de 3 líneas que había en 5+ sitios del código.
     */
    public void invalidateAndNotify() {
        Cache cache = cacheManager.getCache("leaderboard");
        if (cache != null) cache.clear();
        broadcastUpdate("DATA_UPDATED");
    }

    public void broadcastUpdate(String eventType) {
        TextMessage message = new TextMessage("{\"type\": \"" + eventType + "\"}");
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
}
