package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchRadarDTO;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.service.tournament.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Partidos sincronizados de ESPN (solo lectura). */
@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    /**
     * Partidos de una competición. Sin competición no hay respuesta: mezclar las de todas no le sirve a
     * ninguna liga.
     */
    @GetMapping
    public List<MatchResponseDTO> getMatches(@RequestParam Long competitionId) {
        matchService.requirePublicCompetition(competitionId);
        return publicDtos(matchService.getMatchesByCompetition(competitionId));
    }

    /** En juego, últimos terminados y próximos de una competición. */
    @GetMapping("/radar")
    @Cacheable(value = "matchRadar", key = "#competitionId", sync = true)
    public MatchRadarDTO getMatchRadar(@RequestParam Long competitionId) {
        matchService.requirePublicCompetition(competitionId);
        List<Match> live = matchService.getLiveMatches(competitionId);
        List<Match> last = matchService.getLastMatches(5, competitionId);
        List<Match> next = matchService.getNextMatches(5, competitionId);
        return new MatchRadarDTO(publicDtos(live), publicDtos(last),
                publicDtos(next));
    }

    private List<MatchResponseDTO> publicDtos(List<Match> matches) {
        return matchService.publicOnly(matches).stream().map(MatchResponseDTO::fromEntity).toList();
    }
}
