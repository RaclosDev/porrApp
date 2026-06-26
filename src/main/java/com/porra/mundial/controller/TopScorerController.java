package com.porra.mundial.controller;

import com.porra.mundial.service.TopScorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 🥅 Controlador de Pichichi — Expone los máximos goleadores del Mundial
 */
@RestController
@RequestMapping("/api/scorers")
@RequiredArgsConstructor
public class TopScorerController {

    private final TopScorerService topScorerService;

    @GetMapping
    public List<Map<String, Object>> getTopScorers() {
        return topScorerService.getTopScorers();
    }

    @PostMapping("/refresh")
    public Map<String, String> forceRefresh() {
        topScorerService.refresh();
        return Map.of("status", "ok", "scorers", String.valueOf(topScorerService.getTopScorers().size()));
    }

}
