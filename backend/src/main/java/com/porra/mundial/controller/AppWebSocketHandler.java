package com.porra.mundial.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.service.notification.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

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
    private final JwtUtil jwtUtil;

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
            } else if (json.has("type") && "AUTH".equals(json.get("type").asText())) {
                // El token va en un mensaje, no en la URL, para que no acabe en ningún log.
                // Sin token o con uno no válido la sesión queda anónima: solo avisos públicos.
                JsonNode token = json.get("token");
                Long userId = token != null && token.isString()
                        ? jwtUtil.verify(token.asString()).map(JwtUtil.VerifiedToken::userId).orElse(null)
                        : null;
                webSocketService.authenticate(session, userId);
            }
        } catch (Exception e) {
            // Ignorar payloads malformados
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        webSocketService.removeSession(session);
    }
}
