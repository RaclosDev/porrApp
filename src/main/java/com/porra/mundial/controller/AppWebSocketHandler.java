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

/**
 * Manejador principal para la conexión WebSocket (/api/ws).
 * Mantiene en memoria las sesiones abiertas de los clientes conectados y procesa
 * los mensajes de "Hearbeat" para registrar la presencia de usuarios en línea.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AppWebSocketHandler extends TextWebSocketHandler {

    private final WebSocketService webSocketService;
    private final ConnectionLogRepository connectionLogRepository;
    private final UserAccountRepository userAccountRepository;
    private final ObjectMapper objectMapper;

    /** Diccionario en memoria concurrente que mapea el ID interno de sesión de Spring con el Nombre del participante. */
    private final Map<String, String> sessionUserMap = new ConcurrentHashMap<>();
    
    /** Diccionario en memoria concurrente que mapea el Nombre del participante con la fecha/hora de su último latido. */
    private final Map<String, Instant> activeUsers = new ConcurrentHashMap<>();

    /**
     * Evento disparado automáticamente cuando un nuevo cliente Frontend se conecta por WebSocket.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        webSocketService.addSession(session);
    }

    /**
     * Evento disparado cuando el servidor recibe un mensaje de texto desde el cliente Frontend.
     * En este caso, solo procesamos los paquetes de tipo "HEARTBEAT" que envía periódicamente React.
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            JsonNode json = objectMapper.readTree(message.getPayload());
            // Verificamos si es el "latido" de presencia
            if (json.has("type") && "HEARTBEAT".equals(json.get("type").asText())) {
                String name = json.has("name") ? json.get("name").asText().trim() : null;
                
                if (name != null && !name.isEmpty()) {
                    // Verificación de compatibilidad o nombres fijos/temporales
                    if (name.equalsIgnoreCase("Anónimo") || 
                        name.equalsIgnoreCase("anonomio") || 
                        name.equals("LaManoDeDios") ||
                        name.equalsIgnoreCase("RaclosAdmin")) {
                        
                        sessionUserMap.put(session.getId(), name);
                        boolean isNew = !activeUsers.containsKey(name);
                        activeUsers.put(name, Instant.now());
                        
                        // Si es un usuario nuevo recién conectado, avisa a todos en el sistema
                        if (isNew) webSocketService.broadcastUpdate("PRESENCE_UPDATED");
                        return;
                    }

                    // Ignorar la presencia de un visitante que ha puesto un nombre random no registrado en la BD
                    if (!userAccountRepository.existsByParticipantNameIgnoreCase(name)) {
                        return; 
                    }

                    sessionUserMap.put(session.getId(), name);
                    Instant now = Instant.now();
                    
                    // Solo guardar log en base de datos si es una nueva conexión en el sistema (no estaba en memoria)
                    if (!activeUsers.containsKey(name)) {
                        connectionLogRepository.save(new ConnectionLog(name, now));
                        activeUsers.put(name, now);
                        webSocketService.broadcastUpdate("PRESENCE_UPDATED");
                    } else {
                        // Refrescar el contador de tiempo de su última actividad en memoria
                        activeUsers.put(name, now);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Mensaje WebSocket no válido: {}", e.getMessage());
        }
    }

    /**
     * Evento disparado automáticamente cuando se corta la conexión (el usuario cierra la pestaña o pierde red).
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        webSocketService.removeSession(session);
        String name = sessionUserMap.remove(session.getId());
        if (name != null) {
            // Verificar si el usuario tiene otras sesiones abiertas (múltiples pestañas en el navegador)
            boolean hasOtherSessions = sessionUserMap.containsValue(name);
            if (!hasOtherSessions) {
                // Si ya no le quedan pestañas abiertas, lo eliminamos de usuarios activos y avisamos a los demás
                activeUsers.remove(name);
                webSocketService.broadcastUpdate("PRESENCE_UPDATED");
            }
        }
    }
    
    /**
     * Devuelve la lista en memoria de los usuarios activos actualmente.
     * @return Un mapa de nombres de usuario y su último latido.
     */
    public Map<String, Instant> getActiveUsers() {
        return activeUsers;
    }
}
