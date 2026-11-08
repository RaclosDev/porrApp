package com.porra.mundial.service.notification;

import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

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
    /** Usuario identificado en cada sesión (mensaje AUTH). Las sesiones anónimas no están. */
    private final Map<String, Long> sessionUsers = new ConcurrentHashMap<>();
    /** IP de cada sesión y conexiones abiertas por IP, para el tope por IP. */
    private final Map<String, String> sessionIps = new ConcurrentHashMap<>();
    private final Map<String, Integer> connectionsPerIp = new ConcurrentHashMap<>();
    private final CacheManager cacheManager;
    private final ObjectMapper objectMapper;
    private final LeagueAudience leagueAudience;

    /** Atributo de la sesión con la IP del cliente, que pone el handshake. */
    public static final String CLIENT_IP_ATTRIBUTE = "clientIp";

    /**
     * Conexiones abiertas a la vez desde una misma IP. Alto a propósito: en un bar todos los
     * clientes comparten la IP de la wifi. Solo frena a quien abre conexiones sin parar.
     */
    @Value("${app.websocket.max-connections-per-ip:200}")
    int maxConnectionsPerIp = 200;

    /** Quién recibe los avisos de una liga. */
    public record Audience(boolean everyone, Set<Long> userIds) {
        public static final Audience EVERYONE = new Audience(true, Set.of());
        public static final Audience NOBODY = new Audience(false, Set.of());

        boolean includes(Long userId) {
            return everyone || (userId != null && userIds.contains(userId));
        }
    }

    @FunctionalInterface
    public interface LeagueAudience {
        Audience of(Long leagueId);
    }

    public WebSocketService(CacheManager cacheManager, ObjectMapper objectMapper, LeagueAudience leagueAudience) {
        this.cacheManager = cacheManager;
        this.objectMapper = objectMapper;
        this.leagueAudience = leagueAudience;
    }

    /** Registra la sesión, salvo que su IP ya tenga el máximo de conexiones: entonces la cierra. */
    public boolean addSession(WebSocketSession session) {
        Map<String, Object> attributes = session.getAttributes();
        Object ip = attributes != null ? attributes.get(CLIENT_IP_ATTRIBUTE) : null;
        if (ip instanceof String clientIp) {
            boolean[] accepted = {false};
            connectionsPerIp.compute(clientIp, (key, count) -> {
                int current = count == null ? 0 : count;
                if (current >= maxConnectionsPerIp) return count;
                accepted[0] = true;
                return current + 1;
            });
            if (!accepted[0]) {
                log.warn("WebSocket rechazado: demasiadas conexiones desde {}", clientIp);
                try {
                    session.close(CloseStatus.POLICY_VIOLATION);
                } catch (java.io.IOException ignored) {
                    // La conexión ya no se usa.
                }
                return false;
            }
            sessionIps.put(session.getId(), clientIp);
        }
        sessions.put(session.getId(),
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT_BYTES));
        return true;
    }

    /** Asocia (o, con null, desasocia) el usuario de una sesión ya registrada. */
    public void authenticate(WebSocketSession session, Long userId) {
        if (!sessions.containsKey(session.getId())) return;
        if (userId == null) sessionUsers.remove(session.getId());
        else sessionUsers.put(session.getId(), userId);
    }

    /** Conexiones abiertas ahora mismo (métrica {@code porra.websocket.sessions}). */
    public int sessionCount() {
        return sessions.size();
    }

    public void removeSession(WebSocketSession session) {
        dropSession(session.getId());
    }

    private void dropSession(String sessionId) {
        sessions.remove(sessionId);
        sessionUsers.remove(sessionId);
        String ip = sessionIps.remove(sessionId);
        if (ip != null) {
            connectionsPerIp.computeIfPresent(ip, (key, count) -> count <= 1 ? null : count - 1);
        }
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
            "competitionStandings", "groupOdds");
    /** Cachés que muestran el minuto de juego. */
    static final List<String> CLOCK_CACHES = List.of("matches", "matchRadar");

    /**
     * Avisos de liga pendientes de enviar. En el pico antes de un partido llegan muchos guardados
     * seguidos de la misma liga: se agrupan en un solo aviso por liga cada {@link #leagueNoticeDelayMs}
     * y se envían en otro hilo, para que el POST no espere a recorrer todas las sesiones.
     */
    private final Set<Long> pendingLeagueNotices = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService noticeExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ws-league-notices");
        thread.setDaemon(true);
        return thread;
    });

    /** Espera para agrupar avisos de la misma liga. Con 0 se envían en el momento (tests). */
    @Value("${app.websocket.league-notice-delay-ms:2000}")
    long leagueNoticeDelayMs = 2000;

    /**
     * Ha cambiado la configuración de una liga (nombre, miembros, imagen, reglas…): se borran sus
     * entradas de caché y las listas de ligas de los usuarios, y se avisa con su id.
     */
    public void notifyLeagueChanged(Long leagueId) {
        clearCaches(LEAGUE_CACHES);
        notifyPredictionsChanged(leagueId);
    }

    /**
     * Han cambiado las predicciones de una liga: solo se borra su clasificación y se avisa con su id,
     * para que cada cliente recargue únicamente si está viendo esa liga. El aviso de una liga privada
     * solo llega a sus miembros identificados; el de una pública, a todos.
     */
    public void notifyPredictionsChanged(Long leagueId) {
        if (leagueId == null) return;
        evictKey("leaderboard", leagueId);
        notifyMatchPredictionsSaved(leagueId);
    }

    /**
     * Se han guardado pronósticos de partidos aún abiertos: no cambian ningún punto, así que la
     * clasificación cacheada sigue valiendo (si se creó la porra, ya la invalida el servicio).
     * Tirarla en cada guardado obligaba a recalcularla para toda la liga en plena jornada.
     */
    public void notifyMatchPredictionsSaved(Long leagueId) {
        if (leagueId == null) return;
        evictKey("groupById", leagueId);
        if (leagueNoticeDelayMs <= 0) {
            sendLeagueNotice(leagueId);
            return;
        }
        if (pendingLeagueNotices.add(leagueId)) {
            noticeExecutor.schedule(() -> {
                pendingLeagueNotices.remove(leagueId);
                sendLeagueNotice(leagueId);
            }, leagueNoticeDelayMs, TimeUnit.MILLISECONDS);
        }
    }

    private void sendLeagueNotice(Long leagueId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "LEAGUE_UPDATED");
        payload.put("leagueId", leagueId);
        Audience audience;
        try {
            audience = leagueAudience.of(leagueId);
        } catch (Exception e) {
            log.warn("No se pudo resolver quién recibe el aviso de la liga {}: {}", leagueId, e.getMessage());
            audience = Audience.NOBODY;
        }
        try {
            TextMessage message = new TextMessage(objectMapper.writeValueAsString(payload));
            for (Map.Entry<String, WebSocketSession> entry : List.copyOf(sessions.entrySet())) {
                if (audience.includes(sessionUsers.get(entry.getKey()))) send(entry.getValue(), message);
            }
        } catch (Exception e) {
            log.warn("Error enviando el aviso de la liga {} por WebSocket: {}", leagueId, e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        noticeExecutor.shutdownNow();
    }

    /** El nombre o la foto de un usuario salen en todas sus ligas. */
    public void notifyProfileChanged() {
        clearCaches(List.of("leaderboard", "groupById", "userGroups"));
        broadcastUpdate("DATA_UPDATED");
    }

    /**
     * Solo ha avanzado el minuto de juego de algún partido en directo: se refrescan los partidos,
     * pero no las clasificaciones, que no dependen del reloj.
     */
    public void notifyClockChanged() {
        clearCaches(CLOCK_CACHES);
        broadcastUpdate("CLOCK_UPDATED");
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
        } catch (tools.jackson.core.JacksonException e) {
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
        dropSession(session.getId());
    }

    public void broadcastUpdate(String eventType) {
        broadcastJson(Map.of("type", eventType != null ? eventType : "DATA_UPDATED"));
    }

    private void broadcastJson(Map<String, ?> payload) {
        try {
            broadcastRaw(objectMapper.writeValueAsString(payload));
        } catch (tools.jackson.core.JacksonException e) {
            log.warn("Error serializando actualización en WebSocket: {}", e.getMessage());
        }
    }
}
