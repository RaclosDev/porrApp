package com.porra.mundial.controller;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controlador de la Clasificación (Leaderboard).
 * Se encarga de exponer la tabla de puntuaciones calculada a los usuarios.
 */
@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    /**
     * Calcula y devuelve la clasificación general o específica de un grupo.
     * Al recibir la petición, este método desencadena todo el motor de cálculo de puntos en tiempo real
     * (comparando las apuestas de todos los usuarios frente al Bracket Oficial), en vez de devolver
     * un listado estático precalculado.
     * 
     * @param groupId ID del grupo a consultar. Si no se indica, asume el Global (ID = 1).
     * @return Lista de participantes ordenada de mayor a menor puntuación.
     */
    @GetMapping
    public ResponseEntity<List<ParticipantScoreDTO>> getLeaderboard(@RequestParam(required = false, defaultValue = "1") Long groupId) {
        return ResponseEntity.ok(leaderboardService.getLeaderboard(groupId));
    }
}
