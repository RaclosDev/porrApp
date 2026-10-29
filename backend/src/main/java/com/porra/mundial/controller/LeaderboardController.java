package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
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
    private final GroupService groupService;

    /**
     * Calcula y devuelve la clasificación general o específica de un grupo.
     * Al recibir la petición, este método desencadena todo el motor de cálculo de puntos en tiempo real
     * (comparando los pronósticos de todos los usuarios frente al Bracket Oficial), en vez de devolver
     * un listado estático precalculado.
     * 
     * @param groupId liga a consultar; por defecto, la Porra Global.
     * @return Lista de participantes ordenada de mayor a menor puntuación.
     */
    @GetMapping
    public List<ParticipantScoreDTO> getLeaderboard(@RequestParam(required = false) Long groupId, Principal principal) {
        Long leagueId = groupId != null ? groupId : League.GLOBAL_ID;
        groupService.assertCanView(leagueId, CurrentUser.email(principal));
        return leaderboardService.getLeaderboard(leagueId);
    }

    /**
     * Devuelve los puntos de cada participante desglosados por jornada.
     * Permite navegar por jornadas en el ranking sin descargar el detalle completo de cada porra.
     */
    @GetMapping("/matchdays")
    public List<MatchdayPointsDTO> getMatchdayBreakdown(@RequestParam(required = false) Long groupId, Principal principal) {
        Long leagueId = groupId != null ? groupId : League.GLOBAL_ID;
        groupService.assertCanView(leagueId, CurrentUser.email(principal));
        return leaderboardService.getMatchdayBreakdown(leagueId);
    }
}
