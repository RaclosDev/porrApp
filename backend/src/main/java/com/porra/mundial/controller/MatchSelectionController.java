package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchSelectionDTO;
import com.porra.mundial.dto.MatchSelectionRequest;
import com.porra.mundial.service.prediction.MatchSelectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/** Partidos que entran en una liga por jornadas sobre una o varias competiciones oficiales. */
@RestController
@RequiredArgsConstructor
public class MatchSelectionController {
    private final MatchSelectionService service;

    /** Selección actual con todo el calendario de la competición (solo el administrador). */
    @GetMapping("/api/groups/{leagueId}/competition/match-selection")
    public MatchSelectionDTO selection(@PathVariable Long leagueId, Principal principal) {
        return service.view(leagueId, principal.getName());
    }

    @PutMapping("/api/groups/{leagueId}/competition/match-selection")
    public MatchSelectionDTO update(@PathVariable Long leagueId, @Valid @RequestBody MatchSelectionRequest request,
                                   Principal principal) {
        return service.update(leagueId, principal.getName(), request);
    }

    /**
     * Calendario de varias competiciones oficiales (la principal primero) para elegir partidos sueltos
     * de todas al crear una liga.
     */
    @GetMapping("/api/competitions/selectable-matches")
    public MatchSelectionDTO selectableFrom(@RequestParam("ids") List<Long> competitionIds) {
        return service.competitionCalendar(competitionIds);
    }

    /** Calendario de una competición oficial para elegir partidos al crear una liga. */
    @GetMapping("/api/competitions/{competitionId}/selectable-matches")
    public MatchSelectionDTO selectable(@PathVariable Long competitionId) {
        return service.competitionCalendar(competitionId);
    }
}
