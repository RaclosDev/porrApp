package com.porra.mundial.service;

import com.porra.mundial.dto.CustomMatchRequest;
import com.porra.mundial.dto.CustomResultRequest;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomCompetitionService {
    private final EditionRepository editionRepository;
    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final ScoreInvalidationService scoreInvalidationService;

    @Transactional(readOnly = true)
    public List<Team> teams(Long leagueId, String email) {
        Competition competition = ownedCompetition(leagueId, email);
        return teamRepository.findByCompetitionIdOrderByNameAsc(competition.getId());
    }

    @Transactional
    public Team addTeam(Long leagueId, String email, String rawName) {
        Competition competition = ownedCompetition(leagueId, email);
        String name = rawName.trim();
        if (teamRepository.existsByCompetitionIdAndNameIgnoreCase(competition.getId(), name)) {
            throw BusinessException.conflict("Ya existe un equipo con ese nombre");
        }
        return teamRepository.save(Team.builder().name(name).competition(competition).build());
    }

    @Transactional
    @CacheEvict(value = {"matchRadar", "competitionStandings"}, allEntries = true)
    public MatchResponseDTO addMatch(Long leagueId, String email, CustomMatchRequest request) {
        Competition competition = ownedCompetition(leagueId, email);
        if (request.homeTeamId().equals(request.awayTeamId())) {
            throw BusinessException.badRequest("Selecciona dos equipos distintos");
        }
        Team home = team(competition, request.homeTeamId());
        Team away = team(competition, request.awayTeamId());
        if (request.matchDate().isBefore(LocalDateTime.now().minusYears(1))) {
            throw BusinessException.badRequest("La fecha del partido no es válida");
        }
        Match match = matchRepository.save(Match.builder()
                .competition(competition).homeTeam(home).awayTeam(away)
                .matchDate(request.matchDate()).build());
        return MatchResponseDTO.fromEntity(match);
    }

    @Transactional
    @CacheEvict(value = {"matchRadar", "competitionStandings", "matchdayStats"}, allEntries = true)
    public MatchResponseDTO setResult(Long leagueId, Long matchId, String email, CustomResultRequest request) {
        Competition competition = ownedCompetition(leagueId, email);
        Match match = matchRepository.findById(matchId)
                .filter(m -> m.getCompetition() != null && competition.getId().equals(m.getCompetition().getId()))
                .orElseThrow(() -> BusinessException.notFound("Partido no encontrado"));
        match.setHomeScore(request.homeScore());
        match.setAwayScore(request.awayScore());
        match.setFinished(true);
        match.setStatus(MatchStatusNormalized.FINISHED);
        match.setWinnerTeam(request.homeScore() > request.awayScore() ? match.getHomeTeam()
                : request.awayScore() > request.homeScore() ? match.getAwayTeam() : null);
        scoreInvalidationService.invalidateCompetition(competition.getId());
        return MatchResponseDTO.fromEntity(match);
    }

    private Team team(Competition competition, Long teamId) {
        return teamRepository.findById(teamId)
                .filter(t -> t.getCompetition() != null && competition.getId().equals(t.getCompetition().getId()))
                .orElseThrow(() -> BusinessException.badRequest("El equipo no pertenece a esta competición"));
    }

    private Competition ownedCompetition(Long leagueId, String email) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getLeague().getAdminUser() == null
                || !email.equalsIgnoreCase(edition.getLeague().getAdminUser().getGoogleEmail())) {
            throw BusinessException.forbidden("Solo el administrador puede editar esta competición");
        }
        Competition competition = edition.getCompetition();
        if (competition.getOwnerLeague() == null || !leagueId.equals(competition.getOwnerLeague().getId())) {
            throw BusinessException.badRequest("Esta liga no tiene una competición personalizada");
        }
        return competition;
    }
}
