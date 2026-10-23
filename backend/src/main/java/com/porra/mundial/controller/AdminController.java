package com.porra.mundial.controller;

import com.porra.mundial.dto.ManualMatchOverrideDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.SyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controlador de Administración para sincronización de datos deportivos,
 * corrección manual auditada de partidos y cuadro oficial.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final SyncService syncService;
    private final PredictionService predictionService;

    /**
     * Devuelve el estado actual de la sincronización de proveedores deportivos y logs recientes.
     */
    @GetMapping("/sync/status")
    public ResponseEntity<Map<String, Object>> getSyncStatus() {
        return ResponseEntity.ok(syncService.getSyncOverview());
    }

    /**
     * Fuerza la sincronización de una competición o de la competición activa por defecto.
     */
    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncCompetition(
            @RequestParam(name = "competitionId", required = false) Long competitionId) {
        return ResponseEntity.ok(syncService.syncCompetition(competitionId));
    }

    /**
     * Endpoint retrocompatible para refresco global.
     */
    @PostMapping("/sync/refresh")
    public ResponseEntity<Map<String, Object>> forceSync() {
        return ResponseEntity.ok(syncService.syncAll());
    }

    /**
     * Permite a un administrador corregir manualmente el marcador y estado de un partido,
     * recalculando en tiempo real las puntuaciones y notificando por WebSocket.
     */
    @PutMapping("/matches/{id}/manual-result")
    public ResponseEntity<Match> overrideMatchResult(
            @PathVariable("id") Long id,
            @Valid @RequestBody ManualMatchOverrideDTO body,
            Authentication authentication) {
        String adminUser = (authentication != null && authentication.getName() != null)
                ? authentication.getName()
                : "Admin";
        Match match = syncService.overrideMatchResult(
                id,
                body.getHomeScore(),
                body.getAwayScore(),
                body.getStatus(),
                adminUser
        );
        return ResponseEntity.ok(match);
    }

    /**
     * Guarda el cuadro oficial de resultados finales (eliminatorias).
     */
    @PostMapping("/official")
    public ResponseEntity<?> updateOfficialResults(@RequestBody PredictionDataDTO body) {
        Prediction pred = predictionService.createPrediction("Admin", "official", body, null);
        return ResponseEntity.ok(pred);
    }
}
