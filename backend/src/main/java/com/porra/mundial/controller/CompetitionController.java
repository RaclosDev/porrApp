package com.porra.mundial.controller;

import com.porra.mundial.dto.CompetitionDTO;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.service.CompetitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Competiciones disponibles para crear ligas y su clasificación oficial. */
@RestController
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
public class CompetitionController {

    private final CompetitionService competitionService;

    @GetMapping
    public List<CompetitionDTO> getAllCompetitions() {
        return competitionService.findSyncableCompetitions();
    }

    /** Clasificación oficial de una liga regular (LaLiga, Premier, Champions...). */
    @GetMapping("/{id}/standings")
    public List<LeagueStandingDTO> getCompetitionStandings(@PathVariable Long id) {
        return competitionService.getStandings(id);
    }
}
