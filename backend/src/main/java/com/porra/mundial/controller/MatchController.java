package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchRadarDTO;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.model.Fight;
import com.porra.mundial.model.Match;
import com.porra.mundial.service.tournament.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
        List<Match> visible = matchService.publicOnly(matches);
        // Las peleas de la UFC llevan su resultado (ganador, método, asalto y tiempo), no un marcador.
        Map<Long, Fight> fights = matchService.fightsOf(visible);
        return visible.stream().map(m -> MatchResponseDTO.fromEntity(m, fights.get(m.getId()))).toList();
    }
}
