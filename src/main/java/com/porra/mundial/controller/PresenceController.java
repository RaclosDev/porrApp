package com.porra.mundial.controller;

import com.porra.mundial.model.ConnectionLog;
import com.porra.mundial.repository.ConnectionLogRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 👀 Controlador de Presencia y Registro (El "Chivato" y el "Historiador")
 */
@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    private final Map<String, Instant> activeUsers = new ConcurrentHashMap<>();
    private final ConnectionLogRepository connectionLogRepository;

    public PresenceController(ConnectionLogRepository connectionLogRepository) {
        this.connectionLogRepository = connectionLogRepository;
    }

    @PostMapping
    public void heartbeat(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        if (name != null && !name.trim().isEmpty()) {
            String trimmedName = name.trim();
            Instant now = Instant.now();
            
            // No guardar en BBDD si es anónimo o el admin secreto
            if (trimmedName.equalsIgnoreCase("Anónimo") || 
                trimmedName.equalsIgnoreCase("anonomio") || 
                trimmedName.equals("LaManoDeDios") ||
                trimmedName.equalsIgnoreCase("Raclos")) {
                activeUsers.put(trimmedName, now);
                return;
            }

            // Si el usuario no estaba activo, o su última conexión fue hace más de 5 minutos, guardamos un nuevo log
            if (!activeUsers.containsKey(trimmedName) || 
                activeUsers.get(trimmedName).isBefore(now.minusSeconds(300))) {
                connectionLogRepository.save(new ConnectionLog(trimmedName, now));
            }
            
            activeUsers.put(trimmedName, now);
        }
    }

    @GetMapping
    public List<String> getOnlineUsers() {
        Instant threshold = Instant.now().minusSeconds(15);
        activeUsers.entrySet().removeIf(entry -> entry.getValue().isBefore(threshold));
        return activeUsers.keySet().stream().sorted().collect(Collectors.toList());
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(@RequestHeader(value = "X-Admin-Token", required = false) String token) {
        if (!AdminAuthController.isValidToken(token)) return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(connectionLogRepository.findAllByOrderByConnectedAtDesc());
    }
}
