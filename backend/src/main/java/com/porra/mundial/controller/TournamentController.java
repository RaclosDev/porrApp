package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TeamOddsDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.service.tournament.GroupTournamentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Datos oficiales de un torneo con fase de grupos: grupos, probabilidades, cuadro real y goleadores.
 * Responde 404 si la competición no es un torneo de ese tipo.
 */
@RestController
@RequestMapping("/api/competitions/{competitionId}/tournament")
@RequiredArgsConstructor
public class TournamentController {

    private final GroupTournamentService tournaments;

    /** Puntos de cada equipo por grupo: grupo -> equipo -> estadística (pts, diff, gls, mp...). */
    @GetMapping("/standings")
    public Map<String, Map<String, Map<String, Integer>>> getStandings(@PathVariable Long competitionId) {
        return tournaments.groupPoints(tournaments.tournament(competitionId));
    }

    /** Cuadro con los resultados reales, con la misma forma que el de un participante. */
    @GetMapping("/official-bracket")
    public PredictionDataDTO getOfficialBracket(@PathVariable Long competitionId) {
        return tournaments.officialBracket(tournaments.tournament(competitionId));
    }

    /** Probabilidades por grupo ("A" → equipos) para ordenar el cuadro antes del torneo. */
    @GetMapping("/group-odds")
    public Map<String, List<TeamOddsDTO>> getGroupOdds(@PathVariable Long competitionId) {
        return tournaments.groupOdds(tournaments.tournament(competitionId));
    }

    /** Máximos goleadores del torneo, ordenados por goles. */
    @GetMapping("/scorers")
    public List<TopScorerDTO> getTopScorers(@PathVariable Long competitionId) {
        return tournaments.scorers(tournaments.tournament(competitionId));
    }
}
