package com.porra.mundial.controller;

import com.porra.mundial.service.TopScorerService;
import com.porra.mundial.dto.TopScorerDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 *  Controlador de Pichichi (Goleadores).
 * Expone la tabla de máximos goleadores del campeonato.
 */
@RestController
@RequestMapping("/api/scorers")
@RequiredArgsConstructor
public class TopScorerController {

    private final TopScorerService topScorerService;

    /**
     * Obtiene el ranking actual de goleadores en memoria.
     * @return Lista ordenada con el nombre del jugador, goles y país.
     */
    @GetMapping
    public List<TopScorerDTO> getTopScorers() {
        return topScorerService.getTopScorers();
    }
}
