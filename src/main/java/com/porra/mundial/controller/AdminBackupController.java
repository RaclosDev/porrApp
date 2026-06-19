package com.porra.mundial.controller;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetBackup;
import com.porra.mundial.repository.BetBackupRepository;
import com.porra.mundial.service.BetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/backups")
@RequiredArgsConstructor
public class AdminBackupController {

    private final BetBackupRepository betBackupRepository;
    private final BetService betService;

    // Obtener todos los backups
    @GetMapping
    public ResponseEntity<?> getAllBackups() {
        List<BetBackup> backups = betBackupRepository.findAllByOrderByBackupTimestampDesc();
        return ResponseEntity.ok(backups);
    }

    // Crear un backup manual de todas las apuestas actuales
    @PostMapping("/snapshot")
    public ResponseEntity<?> createSnapshot() {
        try {
            betService.createOneTimeSnapshot();
            return ResponseEntity.ok(Map.of("status", "snapshot_created"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Restaurar una apuesta desde un backup concreto
    @PostMapping("/{backupId}/restore")
    public ResponseEntity<?> restoreBackup(@PathVariable Long backupId) {
        try {
            Bet restoredBet = betService.restoreBet(backupId);
            return ResponseEntity.ok(Map.of("status", "restored", "betId", restoredBet.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
