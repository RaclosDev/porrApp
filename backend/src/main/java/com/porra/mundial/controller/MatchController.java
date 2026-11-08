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
     * @param competitionId (Opcional) Filtrar los partidos por competición.
     * @return Todos los partidos de la base de datos (o los de la competición dada).
     */
    @GetMapping
    public List<MatchResponseDTO> getAllMatches(@RequestParam(required = false) Long competitionId) {
        matchService.requirePublicCompetition(competitionId);
        List<Match> matches = competitionId != null
                ? matchService.getMatchesByCompetition(competitionId)
                : matchService.getAllMatches();
        return publicDtos(matches);
    }

    /** En juego, últimos terminados y próximos. */
    @GetMapping("/radar")
    @Cacheable(value = "matchRadar", key = "#competitionId != null ? #competitionId : 'all'", sync = true)
    public MatchRadarDTO getMatchRadar(@RequestParam(required = false) Long competitionId) {
        matchService.requirePublicCompetition(competitionId);
        List<Match> live = competitionId != null ? matchService.getLiveMatches(competitionId) : matchService.getLiveMatches();
        List<Match> last = competitionId != null ? matchService.getLastMatches(5, competitionId) : matchService.getLastMatches(5);
        List<Match> next = competitionId != null ? matchService.getNextMatches(5, competitionId) : matchService.getNextMatches(5);
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
