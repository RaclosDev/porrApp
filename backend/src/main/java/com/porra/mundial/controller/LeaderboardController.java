package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
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
    private final com.porra.mundial.service.GroupService groupService;

    /**
     * Calcula y devuelve la clasificación general o específica de un grupo.
     * Al recibir la petición, este método desencadena todo el motor de cálculo de puntos en tiempo real
     * (comparando los pronósticos de todos los usuarios frente al Bracket Oficial), en vez de devolver
     * un listado estático precalculado.
     * 
     * @param groupId ID del grupo a consultar. Si no se indica, asume el Global (ID = 1).
     * @return Lista de participantes ordenada de mayor a menor puntuación.
     */
    @GetMapping
    public ResponseEntity<List<ParticipantScoreDTO>> getLeaderboard(
            @RequestParam(required = false, defaultValue = "1") Long groupId,
            Principal principal) {
        assertGroupAccess(groupId, principal);
        return ResponseEntity.ok(leaderboardService.getLeaderboard(groupId));
    }

    /**
     * Devuelve los puntos de cada participante desglosados por jornada.
     * Permite navegar por jornadas en el ranking sin descargar el detalle completo de cada porra.
     */
    @GetMapping("/matchdays")
    public ResponseEntity<List<MatchdayPointsDTO>> getMatchdayBreakdown(
            @RequestParam(required = false, defaultValue = "1") Long groupId,
            Principal principal) {
        assertGroupAccess(groupId, principal);
        return ResponseEntity.ok(leaderboardService.getMatchdayBreakdown(groupId));
    }

    private void assertGroupAccess(Long groupId, Principal principal) {
        if (groupId == null || League.isGlobalId(groupId)) return;

        String email = principal != null && principal.getName() != null ? principal.getName() : null;
        if (email == null) {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            email = (auth != null) ? auth.getName() : null;
        }
        if (email == null || !groupService.isUserMemberOrAdmin(groupId, email)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "No tienes acceso a la clasificación de esta liga privada");
        }
    }
}
