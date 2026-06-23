package com.porra.mundial.controller;

import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import com.porra.mundial.service.BetService;
import com.porra.mundial.dto.BetDataDTO;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final SyncService syncService;
    private final UserAccountRepository userAccountRepository;
    private final BetService betService;

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        return ResponseEntity.ok(userAccountRepository.findAll());
    }



    // 🔄 Botón de refresco manual de resultados
    @PostMapping("/sync/refresh")
    public ResponseEntity<?> forceSync() {
        return ResponseEntity.ok(syncService.syncAll());
    }

    // Endpoint for updating official results
    @PostMapping("/official")
    public ResponseEntity<?> updateOfficialResults(@RequestBody BetDataDTO body) {
        return ResponseEntity.ok(betService.createBet("Admin", "official", body, null));
    }



}
