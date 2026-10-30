package com.porra.mundial.service;

import tools.jackson.databind.ObjectMapper;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import lombok.extern.slf4j.Slf4j;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Una sesión WebSocket no admite envíos simultáneos, y aquí escriben a la vez la sincronización,
 * los goleadores y las respuestas a los PING. Por eso cada sesión se envuelve en un
 * {@link ConcurrentWebSocketSessionDecorator}, que encola los mensajes y corta a los clientes lentos.
 */
@Service
@Slf4j
public class WebSocketService {

    /** Tiempo máximo que puede tardar un envío antes de cerrar la sesión. */
    static final int SEND_TIME_LIMIT_MS = 10_000;
    /** Mensajes pendientes que se acumulan para un cliente lento antes de cerrar su sesión. */
    static final int BUFFER_SIZE_LIMIT_BYTES = 512 * 1024;

    /** Sesiones abiertas, ya decoradas, por id de sesión. */
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final CacheManager cacheManager;
    private final ObjectMapper objectMapper;

    public WebSocketService(CacheManager cacheManager, ObjectMapper objectMapper) {
        this.cacheManager = cacheManager;
        this.objectMapper = objectMapper;
    }

    public void addSession(WebSocketSession session) {
        sessions.put(session.getId(),
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT_BYTES));
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session.getId());
    }

    /** Envía un mensaje a una sesión registrada, a través de su decorador. */
    public void sendTo(WebSocketSession session, String jsonPayload) {
        WebSocketSession target = sessions.get(session.getId());
        if (target != null) {
            send(target, new TextMessage(jsonPayload));
        }
    }

    /** Cachés que dependen de los datos de una liga (miembros, pagos, pronósticos, imagen). */
    static final List<String> LEAGUE_CACHES = List.of("userGroups", "groupByCode");
    /** Cachés que dependen de los resultados y equipos que llegan de la sincronización. */
    static final List<String> RESULT_CACHES = List.of(
            "matches", "matchRadar", "standings", "officialPoints", "leaderboard",
            "competitionStandings", "allTeams", "groupOdds");

    /**
     * Algo ha cambiado en una liga: se borran solo sus entradas de caché y se avisa con su id,
     * para que cada cliente recargue únicamente si está viendo esa liga.
     */
    public void notifyLeagueChanged(Long leagueId) {
        evictKey("leaderboard", leagueId);
        evictKey("groupById", leagueId);
        clearCaches(LEAGUE_CACHES);
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "LEAGUE_UPDATED");
        payload.put("leagueId", leagueId);
        broadcastJson(payload);
    }

    /** El nombre o la foto de un usuario salen en todas sus ligas. */
    public void notifyProfileChanged() {
        clearCaches(List.of("leaderboard", "groupById", "userGroups"));
        broadcastUpdate("DATA_UPDATED");
    }

    /** Han cambiado resultados o equipos: las ligas y las competiciones no se tocan. */
    public void notifyResultsChanged() {
        clearCaches(RESULT_CACHES);
        broadcastUpdate("DATA_UPDATED");
    }

    private void evictKey(String cacheName, Object key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null && key != null) cache.evict(key);
    }

    private void clearCaches(List<String> cacheNames) {
        for (String cacheName : cacheNames) {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) cache.clear();
        }
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
        for (WebSocketSession session : List.copyOf(sessions.values())) {
            send(session, message);
        }
    }

    /** Si la sesión está cerrada o el envío falla (también por exceder los límites), se da de baja. */
    private void send(WebSocketSession session, TextMessage message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(message);
                return;
            }
        } catch (Exception e) {
            log.debug("Sesión WebSocket {} descartada: {}", session.getId(), e.getMessage());
        }
        sessions.remove(session.getId());
    }

    public void broadcastUpdate(String eventType) {
        broadcastJson(Map.of("type", eventType != null ? eventType : "DATA_UPDATED"));
    }

    private void broadcastJson(Map<String, ?> payload) {
        try {
            broadcastRaw(objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.warn("Error serializando actualización en WebSocket: {}", e.getMessage());
        }
    }
}
