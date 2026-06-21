package com.porra.mundial.controller;

import com.porra.mundial.repository.ConnectionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 👀 Controlador de Presencia y Registro (El "Chivato" y el "Historiador")
 */
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final AppWebSocketHandler appWebSocketHandler;
    private final ConnectionLogRepository connectionLogRepository;

    @GetMapping
    public List<String> getOnlineUsers() {
        return appWebSocketHandler.getActiveUsers().keySet().stream().sorted().collect(Collectors.toList());
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        return ResponseEntity.ok(connectionLogRepository.findAllByOrderByConnectedAtDesc());
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<?> deleteHistory(@PathVariable Long id) {
        connectionLogRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
