package com.porra.mundial.service.tournament;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TeamOddsDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.CompetitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Datos oficiales de un torneo con fase de grupos: clasificación de sus grupos, probabilidades, cuadro
 * real y goleadores. Es la entrada para quien solo sabe de qué competición los quiere.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class GroupTournamentService {

    private final CompetitionRepository competitionRepository;
    private final StandingsService standingsService;
    private final OfficialResultsService officialResultsService;
    private final TeamService teamService;
    private final TopScorerService topScorerService;

    /** El torneo con grupos de ese id; no existe para quien pregunta si la competición no lo es. */
    public Competition tournament(Long competitionId) {
        return competitionRepository.findById(competitionId)
                .filter(Competition::isGroupTournament)
                .orElseThrow(() -> BusinessException.notFound("Torneo no encontrado"));
    }

    /** El torneo con grupos de ese identificador externo, si está dado de alta. */
    public Optional<Competition> tournament(String externalId) {
        return competitionRepository.findByExternalId(externalId).filter(Competition::isGroupTournament);
    }

    /** Puntos de cada equipo por grupo: grupo -> equipo -> estadística (pts, diff, gls, mp...). */
    public Map<String, Map<String, Map<String, Integer>>> groupPoints(Competition tournament) {
        return standingsService.getGroupPoints(tournament);
    }

    /** Cuadro con los resultados reales, con la misma forma que el de un participante. */
    public PredictionDataDTO officialBracket(Competition tournament) {
        return officialResultsService.bracket(tournament);
    }

    /** Probabilidades por grupo ("A" → equipos) para ordenar el cuadro antes del torneo. */
    public Map<String, List<TeamOddsDTO>> groupOdds(Competition tournament) {
        return teamService.getGroupOdds(tournament);
    }

    /** Máximos goleadores del torneo, ordenados por goles. */
    public List<TopScorerDTO> scorers(Competition tournament) {
        return topScorerService.getTopScorers(tournament);
    }
}
