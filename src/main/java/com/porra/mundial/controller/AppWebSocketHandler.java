package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.ConnectionLog;
import com.porra.mundial.repository.ConnectionLogRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
@RequiredArgsConstructor
public class AppWebSocketHandler extends TextWebSocketHandler {

    private final WebSocketService webSocketService;
    private final ConnectionLogRepository connectionLogRepository;
    private final UserAccountRepository userAccountRepository;
    private final ObjectMapper objectMapper;

    // session ID -> Username
    private final Map<String, String> sessionUserMap = new ConcurrentHashMap<>();
    
    // Username -> Last Connection Time
    private final Map<String, Instant> activeUsers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        webSocketService.addSession(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JsonNode json = objectMapper.readTree(message.getPayload());
            if (json.has("type") && "HEARTBEAT".equals(json.get("type").asText())) {
                String name = json.has("name") ? json.get("name").asText().trim() : null;
                
                if (name != null && !name.isEmpty()) {
                    // Verificación igual que en PresenceController viejo
                    if (name.equalsIgnoreCase("Anónimo") || 
                        name.equalsIgnoreCase("anonomio") || 
                        name.equals("LaManoDeDios") ||
                        name.equalsIgnoreCase("RaclosAdmin")) {
                        
                        sessionUserMap.put(session.getId(), name);
                        boolean isNew = !activeUsers.containsKey(name);
                        activeUsers.put(name, Instant.now());
                        if (isNew) webSocketService.broadcastUpdate("PRESENCE_UPDATED");
                        return;
                    }

                    if (!userAccountRepository.existsByParticipantNameIgnoreCase(name)) {
                        return; // Ignorar visitante no registrado
                    }

                    sessionUserMap.put(session.getId(), name);
                    Instant now = Instant.now();
                    
                    // Solo guardar log si no estaba activo
                    if (!activeUsers.containsKey(name)) {
                        connectionLogRepository.save(new ConnectionLog(name, now));
                        activeUsers.put(name, now);
                        webSocketService.broadcastUpdate("PRESENCE_UPDATED");
                    } else {
                        activeUsers.put(name, now);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Mensaje WebSocket no válido: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        webSocketService.removeSession(session);
        String name = sessionUserMap.remove(session.getId());
        if (name != null) {
            // Verificar si el usuario tiene otras sesiones abiertas (múltiples pestañas)
            boolean hasOtherSessions = sessionUserMap.containsValue(name);
            if (!hasOtherSessions) {
                activeUsers.remove(name);
                webSocketService.broadcastUpdate("PRESENCE_UPDATED");
            }
        }
    }
    
    public Map<String, Instant> getActiveUsers() {
        return activeUsers;
    }
}
