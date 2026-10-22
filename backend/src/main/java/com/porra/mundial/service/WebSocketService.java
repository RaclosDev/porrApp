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
 *  Servicio WebSocket.
 * Mantiene la lista de clientes (Navegadores web) conectados en tiempo real.
 * Si ocurre un gol (desde ESPN) o alguien sube su apuesta, manda una señal 
 * para que todos los navegadores recarguen los datos automáticamente.
 */
@Service
@Slf4j
public class WebSocketService {

    /** Lista "thread-safe" de sesiones abiertas actualmente en el servidor. */
    private final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
    private final CacheManager cacheManager;

    public WebSocketService(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    /** Registra un nuevo navegador conectado. */
    public void addSession(WebSocketSession session) {
        sessions.add(session);
    }

    /** Elimina un navegador que cerró la pestaña. */
    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
    }

    /**
     * Invalida la caché del leaderboard y avisa a todos los clientes conectados.
     * Sustituye el patrón repetido de 3 líneas que había en 5+ sitios del código.
     * Si los datos oficiales cambian (por ej. un gol), todos ven su nueva puntuación al instante.
     */
    public void invalidateAndNotify() {
        Cache cache = cacheManager.getCache("leaderboard");
        if (cache != null) cache.clear();
        broadcastUpdate("DATA_UPDATED");
    }

    /**
     * Dispara un evento a través de WebSockets hacia todos los clientes vivos.
     * Retira silenciosamente de la lista a los clientes que hayan cortado conexión (dead sessions).
     * @param eventType Tipo de evento (ej. "DATA_UPDATED", "NEW_CHAT_MESSAGE").
     */
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
        // Limpiamos la basura acumulada
        sessions.removeAll(deadSessions);
    }
}
