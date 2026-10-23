package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controlador de Administracion para sincronizacion y cuadro oficial.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final SyncService syncService;
    private final PredictionService predictionService;

    @Value("${admin.password:}")
    private String adminPassword;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String pass = body.get("password");
        if (adminPassword != null && !adminPassword.isEmpty() && adminPassword.equals(pass)) {
            return ResponseEntity.ok(Map.of("token", "admin-logged-in-dummy-token"));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Password incorrecto"));
    }

    @PostMapping("/sync/refresh")
    public ResponseEntity<?> forceSync() {
        return ResponseEntity.ok(syncService.syncAll());
    }

    @PostMapping("/official")
    public ResponseEntity<?> updateOfficialResults(@RequestBody PredictionDataDTO body) {
        Prediction pred = predictionService.createPrediction("Admin", "official", body, null);
        return ResponseEntity.ok(pred);
    }
}
