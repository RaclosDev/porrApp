package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayStatsDTO;
import com.porra.mundial.service.MatchdayStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/** Estadísticas de las ligas por jornadas. */
@RestController
@RequestMapping("/api/predictions/matchday/stats")
@RequiredArgsConstructor
public class MatchdayStatsController {

    private final MatchdayStatsService matchdayStatsService;

    /**
     * Reparto 1X2 y marcadores más repetidos de los partidos que ya han empezado.
     * Solo para miembros de la liga.
     */
    @GetMapping
    public MatchdayStatsDTO getMatchdayStats(@RequestParam Long groupId, Principal principal) {
        return matchdayStatsService.getStats(CurrentUser.email(principal), groupId);
    }
}
