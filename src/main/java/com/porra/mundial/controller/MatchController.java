package com.porra.mundial.controller;

import com.porra.mundial.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 🏟️ Controlador de Partidos
 * Aquí le mandamos a la web toda la información sobre qué equipos juegan, cuándo, y cómo van.
 */
@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    /**
     * 📅 GET /api/matches
     * Devuelve tooodos los partidos del Mundial de golpe.
     */
    @GetMapping
    public List<Map<String, Object>> getAllMatches() {
        return matchService.getAllMatches().stream()
                .map(matchService::toMatchDto)
                .collect(Collectors.toList());
    }

    /**
     * 🚨 GET /api/matches/live
     * La web nos pregunta: "¿Hay algún partido jugándose AHORA MISMO?"
     * Útil para poner el cartelito de "En Directo" parpadeando.
     */
    @GetMapping("/live")
    public List<Map<String, Object>> getLiveMatches() {
        return matchService.getLiveMatches().stream()
                .map(matchService::toMatchDto)
                .collect(Collectors.toList());
    }

    /**
     * ⏪ GET /api/matches/last
     * Pide los últimos X partidos que acaban de terminar (por defecto 5).
     */
    @GetMapping("/last")
    public List<Map<String, Object>> getLastMatches(@RequestParam(defaultValue = "5") int limit) {
        return matchService.getLastMatches(limit).stream()
                .map(matchService::toMatchDto)
                .collect(Collectors.toList());
    }

    /**
     * ⏩ GET /api/matches/next
     * Pide los próximos X partidos que se van a jugar (por defecto 5).
     */
    @GetMapping("/next")
    public List<Map<String, Object>> getNextMatches(@RequestParam(defaultValue = "5") int limit) {
        return matchService.getNextMatches(limit).stream()
                .map(matchService::toMatchDto)
                .collect(Collectors.toList());
    }

    /**
     * 🔠 GET /api/matches/group/{group}
     * Devuelve solo los partidos de un grupo concreto (ej. 'A').
     */
    @GetMapping("/group/{group}")
    public List<Map<String, Object>> getGroupMatches(@PathVariable String group) {
        return matchService.getMatchesByGroup(group.toUpperCase()).stream()
                .map(matchService::toMatchDto)
                .collect(Collectors.toList());
    }

    /**
     * GET /api/matches/radar - Combined live/last/next for the Match Radar
     */
    @GetMapping("/radar")
    public Map<String, Object> getMatchRadar() {
        Map<String, Object> radar = new java.util.LinkedHashMap<>();
        radar.put("live", matchService.getLiveMatches().stream().map(matchService::toMatchDto).collect(Collectors.toList()));
        radar.put("last", matchService.getLastMatches(5).stream().map(matchService::toMatchDto).collect(Collectors.toList()));
        radar.put("next", matchService.getNextMatches(5).stream().map(matchService::toMatchDto).collect(Collectors.toList()));
        return radar;
    }
}
