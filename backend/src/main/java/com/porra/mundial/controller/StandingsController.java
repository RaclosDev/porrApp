package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.service.OfficialResultsService;
import com.porra.mundial.service.StandingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Clasificaciones de la fase de grupos y cuadro oficial del torneo. */
@RestController
@RequestMapping("/api/standings")
@RequiredArgsConstructor
public class StandingsController {

    private final StandingsService standingsService;
    private final OfficialResultsService officialResultsService;

    /** Puntos de cada equipo por grupo: grupo -> equipo -> estadística (pts, diff, gls, mp...). */
    @GetMapping
    public Map<String, Map<String, Map<String, Integer>>> getStandings() {
        return standingsService.getOfficialPoints();
    }

    /** Cuadro con los resultados reales, con la misma forma que el de un participante. */
    @GetMapping("/official-bracket")
    public PredictionDataDTO getOfficialBracket() {
        return officialResultsService.officialBracket();
    }
}
