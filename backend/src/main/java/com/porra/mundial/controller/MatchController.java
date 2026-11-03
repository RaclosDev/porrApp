package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchRadarDTO;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.service.MatchService;
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
    private final CompetitionRepository competitionRepository;

    /**
     * @param competitionId (Opcional) Filtrar los partidos por competición.
     * @return Todos los partidos de la base de datos (o los de la competición dada).
     */
    @GetMapping
    public List<MatchResponseDTO> getAllMatches(@RequestParam(required = false) Long competitionId) {
        requirePublicCompetition(competitionId);
        List<Match> matches = competitionId != null
                ? matchService.getMatchesByCompetition(competitionId)
                : matchService.getAllMatches();
        return toDtos(publicMatches(matches));
    }

    /** En juego, últimos terminados y próximos. */
    @GetMapping("/radar")
    @Cacheable(value = "matchRadar", key = "#competitionId != null ? #competitionId : 'all'")
    public MatchRadarDTO getMatchRadar(@RequestParam(required = false) Long competitionId) {
        requirePublicCompetition(competitionId);
        List<Match> live = competitionId != null ? matchService.getLiveMatches(competitionId) : matchService.getLiveMatches();
        List<Match> last = competitionId != null ? matchService.getLastMatches(5, competitionId) : matchService.getLastMatches(5);
        List<Match> next = competitionId != null ? matchService.getNextMatches(5, competitionId) : matchService.getNextMatches(5);
        return new MatchRadarDTO(toDtos(publicMatches(live)), toDtos(publicMatches(last)),
                toDtos(publicMatches(next)));
    }

    private void requirePublicCompetition(Long competitionId) {
        if (competitionId != null && competitionRepository.existsByIdAndOwnerLeagueIsNotNull(competitionId)) {
            throw BusinessException.notFound("Competición no encontrada");
        }
    }

    private List<Match> publicMatches(List<Match> matches) {
        if (matches == null || matches.isEmpty()) return List.of();
        List<Long> privateIds = competitionRepository.findPrivateCompetitionIds();
        if (privateIds == null || privateIds.isEmpty()) return matches;
        return matches.stream().filter(match -> match.getCompetition() == null
                || !privateIds.contains(match.getCompetition().getId())).toList();
    }

    private static List<MatchResponseDTO> toDtos(List<Match> matches) {
        return matches.stream().map(MatchResponseDTO::fromEntity).toList();
    }
}
