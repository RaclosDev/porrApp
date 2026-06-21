package com.porra.mundial.controller;

import com.porra.mundial.model.Team;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 👑 Controlador del Administrador (Tú)
 * Rutas especiales para gestionar la porra desde la interfaz, como los botones de desempate manual.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final TeamRepository teamRepository;
    private final SyncService syncService;
    private final UserAccountRepository userAccountRepository;

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        return ResponseEntity.ok(userAccountRepository.findAll());
    }



    // 🔄 Botón de refresco manual de resultados
    @PostMapping("/sync/refresh")
    public ResponseEntity<?> forceSync() {
        return ResponseEntity.ok(syncService.syncAll());
    }



}
