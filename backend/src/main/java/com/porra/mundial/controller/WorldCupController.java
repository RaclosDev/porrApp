package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TeamOddsDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.service.tournament.OfficialResultsService;
import com.porra.mundial.service.tournament.StandingsService;
import com.porra.mundial.service.tournament.TeamService;
import com.porra.mundial.service.tournament.TopScorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Datos oficiales del Mundial: grupos, probabilidades, cuadro real y goleadores. Solo sirven a las
 * ligas del Mundial; el resto de competiciones tiene sus datos en {@code /api/competitions/{id}}.
 */
@RestController
@RequestMapping("/api/world-cup")
@RequiredArgsConstructor
public class WorldCupController {

    private final StandingsService standingsService;
    private final OfficialResultsService officialResultsService;
    private final TeamService teamService;
    private final TopScorerService topScorerService;

    /** Puntos de cada selección por grupo: grupo -> equipo -> estadística (pts, diff, gls, mp...). */
    @GetMapping("/standings")
    public Map<String, Map<String, Map<String, Integer>>> getStandings() {
        return standingsService.getWorldCupGroupPoints();
    }

    /** Cuadro con los resultados reales, con la misma forma que el de un participante. */
    @GetMapping("/official-bracket")
    public PredictionDataDTO getOfficialBracket() {
        return officialResultsService.worldCupBracket();
    }

    /** Probabilidades por grupo ("A" → selecciones) para ordenar el cuadro antes del torneo. */
    @GetMapping("/group-odds")
    public Map<String, List<TeamOddsDTO>> getGroupOdds() {
        return teamService.getWorldCupGroupOdds();
    }

    /** Máximos goleadores del torneo, ordenados por goles. */
    @GetMapping("/scorers")
    public List<TopScorerDTO> getTopScorers() {
        return topScorerService.getTopScorers();
    }
}
