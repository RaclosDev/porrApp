package com.porra.mundial.controller;

import com.porra.mundial.repository.ConnectionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 👀 Controlador de Presencia y Registro (El "Chivato" y el "Historiador").
 * Expone la información recolectada por el WebSocketHandler sobre qué usuarios
 * están actualmente conectados leyendo la porra.
 */
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final AppWebSocketHandler appWebSocketHandler;
    private final ConnectionLogRepository connectionLogRepository;

    /**
     * @return Lista de nombres de usuario que tienen actualmente una sesión WebSocket abierta y activa.
     */
    @GetMapping
    public List<String> getOnlineUsers() {
        return appWebSocketHandler.getActiveUsers().keySet().stream().sorted().collect(Collectors.toList());
    }

    /**
     * @return Historial completo de conexiones de la base de datos (Quién se conectó y cuándo).
     */
    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        return ResponseEntity.ok(connectionLogRepository.findAllByOrderByConnectedAtDesc());
    }

    /**
     * Elimina un registro del historial.
     * @param id ID del ConnectionLog.
     */
    @DeleteMapping("/history/{id}")
    public ResponseEntity<?> deleteHistory(@PathVariable Long id) {
        connectionLogRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
