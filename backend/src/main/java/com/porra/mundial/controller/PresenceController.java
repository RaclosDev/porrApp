package com.porra.mundial.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Collections;
import java.util.List;

/**
 * Controlador de Presencia (Desactivado para escalabilidad).
 * Mantenido con respuestas no-op para compatibilidad retroactiva.
 */
@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    @GetMapping
    public List<String> getOnlineUsers() {
        return Collections.emptyList();
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        return ResponseEntity.ok(Collections.emptyList());
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<?> deleteHistory(@PathVariable Long id) {
        return ResponseEntity.ok().build();
    }
}
