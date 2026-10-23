package com.porra.mundial.controller;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetBackup;
import com.porra.mundial.repository.BetBackupRepository;
import com.porra.mundial.service.PredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controlador REST exclusivo para administradores.
 * Gestiona el sistema de copias de seguridad de las apuestas (Snapshots manuales y restauración).
 * Útil para recuperar datos de usuarios que modifican accidentalmente sus predicciones en momentos no permitidos.
 */
@RestController
@RequestMapping("/api/admin/backups")
@RequiredArgsConstructor
public class AdminBackupController {

    private final BetBackupRepository betBackupRepository;
    private final PredictionService predictionService;

    /**
     * Endpoint para obtener el historial completo de copias de seguridad.
     * 
     * @return Lista de todos los objetos BetBackup ordenados descendentemente por fecha de creación.
     */
    @GetMapping
    public ResponseEntity<?> getAllBackups() {
        List<BetBackup> backups = betBackupRepository.findAllByOrderByBackupTimestampDesc();
        return ResponseEntity.ok(backups);
    }

    /**
     * Crea una copia de seguridad "foto" de absolutamente todas las apuestas del sistema en este instante.
     * Clona el DTO JSON completo y lo guarda en la tabla de BetBackups.
     * 
     * @return Respuesta OK indicando el éxito, o BAD_REQUEST si algo falla.
     */
    @PostMapping("/snapshot")
    public ResponseEntity<?> createSnapshot() {
        try {
            predictionService.createOneTimeSnapshot();
            return ResponseEntity.ok(Map.of("status", "snapshot_created"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Restaura una apuesta específica de un usuario concreto a su estado almacenado en un ID de backup.
     * Esto pisará los datos relacionales actuales de dicha apuesta con los del snapshot.
     * 
     * @param backupId El ID interno del backup que se desea restaurar.
     * @return El ID de la apuesta que fue restaurada.
     */
    @PostMapping("/{backupId}/restore")
    public ResponseEntity<?> restoreBackup(@PathVariable Long backupId) {
        try {
            Bet restoredBet = predictionService.restoreBet(backupId);
            return ResponseEntity.ok(Map.of("status", "restored", "betId", restoredBet.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
