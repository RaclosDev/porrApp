package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;

/**
 * Manejador principal para la conexión WebSocket (/api/ws).
 * Gestiona el registro y desregistro de sesiones para recibir notificaciones
 * en tiempo real de partidos y clasificaciones.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AppWebSocketHandler extends TextWebSocketHandler {

    private final WebSocketService webSocketService;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        webSocketService.addSession(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JsonNode json = objectMapper.readTree(message.getPayload());
            if (json.has("type") && "PING".equals(json.get("type").asText())) {
                // A través del servicio: la sesión no admite este envío a la vez que una difusión.
                webSocketService.sendTo(session, "{\"type\":\"PONG\"}");
            }
        } catch (Exception e) {
            // Ignorar payloads malformados
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        webSocketService.removeSession(session);
    }

    public Map<String, Instant> getActiveUsers() {
        return Collections.emptyMap();
    }
}
