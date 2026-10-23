package com.porra.mundial.controller;

import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionBackup;
import com.porra.mundial.repository.PredictionBackupRepository;
import com.porra.mundial.service.PredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controlador REST para administradores.
 * Gestiona el sistema de copias de seguridad de los pronosticos.
 */
@RestController
@RequestMapping("/api/admin/backups")
@RequiredArgsConstructor
public class AdminBackupController {

    private final PredictionBackupRepository predictionBackupRepository;
    private final PredictionService predictionService;

    @GetMapping
    public ResponseEntity<?> getAllBackups() {
        List<PredictionBackup> backups = predictionBackupRepository.findAllByOrderByBackupTimestampDesc();
        return ResponseEntity.ok(backups);
    }

    @PostMapping("/snapshot")
    public ResponseEntity<?> createSnapshot() {
        try {
            predictionService.createOneTimeSnapshot();
            return ResponseEntity.ok(Map.of("status", "snapshot_created"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{backupId}/restore")
    public ResponseEntity<?> restoreBackup(@PathVariable Long backupId) {
        try {
            Prediction restored = predictionService.restorePrediction(backupId);
            return ResponseEntity.ok(Map.of("status", "restored", "predictionId", restored.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
