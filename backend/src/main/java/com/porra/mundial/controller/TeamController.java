package com.porra.mundial.controller;

import com.porra.mundial.service.TeamService;
import com.porra.mundial.dto.TeamOddsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Selecciones del torneo. */
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    /** Probabilidades por grupo ("A" → equipos) para ordenar el cuadro antes del torneo. */
    @GetMapping("/odds")
    public Map<String, List<TeamOddsDTO>> getGroupOdds() {
        return teamService.getGroupOdds();
    }
}
