package com.porra.mundial.controller;

import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import com.porra.mundial.service.PredictionService;
import com.porra.mundial.dto.BetDataDTO;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Map;

/**
 * Controlador REST para utilidades genéricas de administración.
 * Permite inspeccionar los usuarios registrados, forzar la sincronización con ESPN, 
 * y manipular el resultado Oficial del Mundial que sirve como base para evaluar a los participantes.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final SyncService syncService;
    private final UserAccountRepository userAccountRepository;
    private final PredictionService predictionService;

    /**
     * Endpoint para obtener el listado completo de cuentas de usuario del sistema.
     * 
     * @return Una lista JSON de UserAccount.
     */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        return ResponseEntity.ok(userAccountRepository.findAll());
    }

    /**
     * Botón de emergencia para forzar un refresco manual de los resultados conectándose
     * a la API de ESPN y actualizando todas las clasificaciones de forma síncrona.
     * 
     * @return Una cadena confirmando la actualización o el error producido.
     */
    @PostMapping("/sync/refresh")
    public ResponseEntity<?> forceSync() {
        return ResponseEntity.ok(syncService.syncAll());
    }

    /**
     * Actualiza y sobrescribe de forma manual el cuadro "Oficial" del campeonato.
     * Convierte los datos enviados en un objeto Bet vinculado al usuario "Admin".
     * 
     * @param body El estado del bracket oficial desde la UI de administrador (BetDataDTO).
     * @return Información de la apuesta/cuadro oficial guardada.
     */
    @PostMapping("/official")
    public ResponseEntity<?> updateOfficialResults(@RequestBody BetDataDTO body) {
        return ResponseEntity.ok(predictionService.createBet("Admin", "official", body, null));
    }



}
