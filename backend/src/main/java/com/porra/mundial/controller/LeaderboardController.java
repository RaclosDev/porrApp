package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;
    private final GroupService groupService;

    /**
     * Clasificación de una liga. Usa los puntos guardados y
     * recalcula si alguna porra está invalidada.
     */
    @GetMapping
    public List<ParticipantScoreDTO> getLeaderboard(@RequestParam Long groupId, Principal principal) {
        groupService.assertCanView(groupId, CurrentUser.email(principal));
        return leaderboardService.getLeaderboard(groupId);
    }

    /**
     * Devuelve los puntos de cada participante desglosados por jornada.
     * Permite navegar por jornadas en el ranking sin descargar el detalle completo de cada porra.
     */
    @GetMapping("/matchdays")
    public List<MatchdayPointsDTO> getMatchdayBreakdown(@RequestParam Long groupId, Principal principal) {
        groupService.assertCanView(groupId, CurrentUser.email(principal));
        return leaderboardService.getMatchdayBreakdown(groupId);
    }
}
