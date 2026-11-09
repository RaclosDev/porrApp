package app.porrapp.controller;

import app.porrapp.dto.CompetitionDTO;
import app.porrapp.dto.LeagueStandingDTO;
import app.porrapp.service.tournament.CompetitionService;
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
    private final app.porrapp.service.tournament.CompetitionPlayerService competitionPlayerService;

    @GetMapping
    public List<CompetitionDTO> getAllCompetitions() {
        return competitionService.findSyncableCompetitions();
    }

    /**
     * Jugadores entre los que elegir el pichichi de una competición de fútbol: sus plantillas y sus
     * goleadores, por orden alfabético. Vacío si no se tienen.
     */
    @GetMapping("/{id}/players")
    public List<app.porrapp.dto.ScorerCandidateDTO> getCompetitionPlayers(@PathVariable Long id) {
        return competitionPlayerService.players(id);
    }

    /** Clasificación oficial de una liga regular (LaLiga, Premier, Champions...). */
    @GetMapping("/{id}/standings")
    public List<LeagueStandingDTO> getCompetitionStandings(@PathVariable Long id) {
        return competitionService.getStandings(id);
    }
}
