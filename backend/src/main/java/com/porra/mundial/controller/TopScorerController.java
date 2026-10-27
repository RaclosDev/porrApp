package com.porra.mundial.controller;

import com.porra.mundial.service.TopScorerService;
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
    public List<Map<String, Object>> getTopScorers() {
        return topScorerService.getTopScorers();
    }

    /**
     * Permite a un administrador forzar la descarga de los últimos goleadores
     * saltándose el caché de memoria.
     * @return Resultado de la operación y el conteo de goleadores procesados.
     */
    @PostMapping("/refresh")
    public Map<String, String> forceRefresh() {
        topScorerService.refresh();
        return Map.of("status", "ok", "scorers", String.valueOf(topScorerService.getTopScorers().size()));
    }

}
