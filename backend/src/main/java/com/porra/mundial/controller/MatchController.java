package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controlador REST para los Partidos Oficiales (Matches).
 * Exposición de solo-lectura de la base de datos de partidos sincronizada desde la API de ESPN.
 * Usado por la aplicación React para pintar los resultados reales en la interfaz.
 */
@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    /**
     * @param competitionId (Opcional) Filtrar los partidos por competición.
     * @return Todos los partidos de la base de datos (o los de la competición dada).
     */
    @GetMapping
    public List<MatchResponseDTO> getAllMatches(@RequestParam(required = false) Long competitionId) {
        List<Match> matches = competitionId != null
                ? matchService.getMatchesByCompetition(competitionId)
                : matchService.getAllMatches();
        if (matches.isEmpty() && competitionId != null) {
            matches = matchService.getAllMatches();
        }
        return matches.stream()
                .map(MatchResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * @return Los partidos que se están jugando en este momento exacto.
     */
    @GetMapping("/live")
    public List<MatchResponseDTO> getLiveMatches() {
        return matchService.getLiveMatches().stream()
                .map(MatchResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * @param limit Número máximo de partidos a devolver.
     * @return Los últimos N partidos que ya han finalizado.
     */
    @GetMapping("/last")
    public List<MatchResponseDTO> getLastMatches(@RequestParam(defaultValue = "5") int limit) {
        return matchService.getLastMatches(limit).stream()
                .map(MatchResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * @param limit Número máximo de partidos a devolver.
     * @return Los próximos N partidos agendados en el calendario.
     */
    @GetMapping("/next")
    public List<MatchResponseDTO> getNextMatches(@RequestParam(defaultValue = "5") int limit) {
        return matchService.getNextMatches(limit).stream()
                .map(MatchResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * @param group La letra del grupo (Ej: "A").
     * @return Partidos pertenecientes a un grupo de la fase de grupos.
     */
    @GetMapping("/group/{group}")
    public List<MatchResponseDTO> getGroupMatches(@PathVariable String group) {
        return matchService.getMatchesByGroup(group.toUpperCase()).stream()
                .map(MatchResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Agregador conveniente para la pantalla de inicio del Frontend ("El Radar").
     * @return Mapa combinado con partidos en vivo, finalizados recientemente y los próximos.
     */
    @GetMapping("/radar")
    @org.springframework.cache.annotation.Cacheable("matchRadar")
    public Map<String, List<MatchResponseDTO>> getMatchRadar() {
        Map<String, List<MatchResponseDTO>> radar = new java.util.LinkedHashMap<>();
        radar.put("live", matchService.getLiveMatches().stream().map(MatchResponseDTO::fromEntity).collect(Collectors.toList()));
        radar.put("last", matchService.getLastMatches(5).stream().map(MatchResponseDTO::fromEntity).collect(Collectors.toList()));
        radar.put("next", matchService.getNextMatches(5).stream().map(MatchResponseDTO::fromEntity).collect(Collectors.toList()));
        return radar;
    }
}
