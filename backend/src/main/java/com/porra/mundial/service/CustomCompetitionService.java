package com.porra.mundial.service;

import com.porra.mundial.dto.CustomMatchRequest;
import com.porra.mundial.dto.CustomResultRequest;
import com.porra.mundial.dto.MatchResponseDTO;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
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
    private final MembershipRepository membershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final PredictionRepository predictionRepository;
    private final CompetitionService competitionService;

    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode"}, allEntries = true)
    public LocalDateTime setLockDate(Long leagueId, String email, LocalDateTime lockDate) {
        ownedCompetition(leagueId, email);
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.MATCH_DAY) {
            throw BusinessException.badRequest("Esta competición se juega por jornadas");
        }
        if (lockDate == null || !lockDate.isAfter(LocalDateTime.now(java.time.ZoneId.of("Europe/Madrid")))) {
            throw BusinessException.badRequest("La fecha de cierre debe ser futura");
        }
        if (!predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
            throw BusinessException.conflict("No se puede cambiar el cierre después del primer pronóstico");
        }
        edition.setLockDate(lockDate);
        return lockDate;
    }

    @Transactional(readOnly = true)
    public List<Team> teams(Long leagueId, String email) {
        Competition competition = memberCompetition(leagueId, email);
        return teamRepository.findByCompetitionIdOrderByNameAsc(competition.getId());
    }

    @Transactional(readOnly = true)
    public List<MatchResponseDTO> matches(Long leagueId, String email) {
        Competition competition = memberCompetition(leagueId, email);
        return matchRepository.findByCompetitionIdOrderByMatchDateAsc(competition.getId()).stream()
                .map(MatchResponseDTO::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<LeagueStandingDTO> standings(Long leagueId, String email) {
        Competition competition = memberCompetition(leagueId, email);
        return competitionService.getCustomStandings(competition.getId());
    }

    private Competition memberCompetition(Long leagueId, String email) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        Competition competition = edition.getCompetition();
        if (competition == null || competition.getOwnerLeague() == null
                || !leagueId.equals(competition.getOwnerLeague().getId())) {
            throw BusinessException.notFound("Competición personalizada no encontrada");
        }
        boolean admin = edition.getLeague().getAdminUser() != null
                && email.equalsIgnoreCase(edition.getLeague().getAdminUser().getGoogleEmail());
        boolean member = userAccountRepository.findByGoogleEmail(email)
                .map(user -> membershipRepository.existsById(new Membership.MembershipId(user.getId(), leagueId)))
                .orElse(false);
        if (!admin && !member) throw BusinessException.forbidden("No perteneces a esta liga");
        return competition;
    }

    @Transactional
    public Team addTeam(Long leagueId, String email, String rawName) {
        return addTeam(leagueId, email, rawName, null);
    }

    @Transactional
    public Team addTeam(Long leagueId, String email, String rawName, String rawGroupName) {
        Competition competition = ownedCompetition(leagueId, email);
        String name = rawName.trim();
        String groupName = rawGroupName == null ? null : rawGroupName.trim();
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getPoolFormat() != com.porra.mundial.model.PoolFormat.MATCH_DAY
                && !predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
            throw BusinessException.conflict("No se pueden cambiar los equipos después del primer pronóstico");
        }
        if (edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.FULL_BRACKET) {
            if (groupName == null || groupName.isBlank() || groupName.length() > 50) {
                throw BusinessException.badRequest("Indica un grupo de hasta 50 caracteres");
            }
        } else if (groupName != null && !groupName.isBlank()) {
            throw BusinessException.badRequest("Este formato no tiene fase de grupos");
        }
        if (teamRepository.existsByCompetitionIdAndNameIgnoreCase(competition.getId(), name)) {
            throw BusinessException.conflict("Ya existe un equipo con ese nombre");
        }
        return teamRepository.save(Team.builder().name(name).competition(competition)
                .groupName(groupName == null || groupName.isBlank() ? null : groupName).build());
    }

    @Transactional
    public void deleteTeam(Long leagueId, Long teamId, String email) {
        Competition competition = ownedCompetition(leagueId, email);
        Team selected = team(competition, teamId);
        if (!predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
            throw BusinessException.conflict("No se pueden cambiar los equipos después del primer pronóstico");
        }
        boolean inUse = matchRepository.findByCompetitionId(competition.getId()).stream()
                .anyMatch(match -> match.getHomeTeam() != null && teamId.equals(match.getHomeTeam().getId())
                        || match.getAwayTeam() != null && teamId.equals(match.getAwayTeam().getId()));
        if (inUse) throw BusinessException.conflict("Elimina antes los partidos de este equipo");
        teamRepository.delete(selected);
    }

    @Transactional
    @CacheEvict(value = {"matches", "matchRadar", "competitionStandings"}, allEntries = true)
    public MatchResponseDTO addMatch(Long leagueId, String email, CustomMatchRequest request) {
        Competition competition = ownedCompetition(leagueId, email);
        if (request.homeTeamId().equals(request.awayTeamId())) {
            throw BusinessException.badRequest("Selecciona dos equipos distintos");
        }
        Team home = team(competition, request.homeTeamId());
        Team away = request.awayTeamId() == null ? null : team(competition, request.awayTeamId());
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        String round = request.round() == null ? "group" : request.round().trim();
        boolean bracket = round.matches("bracket-(?:[1-9]|[12][0-9]|3[01])");
        if (edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.MATCH_DAY) {
            if (bracket || away == null) throw BusinessException.badRequest("Esta liga se juega por jornadas");
        } else if (!bracket && !"group".equals(round)) {
            throw BusinessException.badRequest("Ronda no válida");
        } else if ("group".equals(round) && (edition.getPoolFormat() != com.porra.mundial.model.PoolFormat.FULL_BRACKET
                || away == null || home.getGroupName() == null
                || !home.getGroupName().equals(away.getGroupName()))) {
            throw BusinessException.badRequest("El partido de grupos requiere dos equipos del mismo grupo");
        }
        if ("bracket-1".equals(round)) {
            if (!predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
                throw BusinessException.conflict("No se pueden cambiar los cruces después del primer pronóstico");
            }
            boolean repeated = matchRepository.findByCompetitionId(competition.getId()).stream()
                    .filter(existing -> "bracket-1".equals(existing.getRound()))
                    .anyMatch(existing -> existing.getHomeTeam() != null
                            && (existing.getHomeTeam().getId().equals(home.getId())
                                || away != null && existing.getHomeTeam().getId().equals(away.getId()))
                            || existing.getAwayTeam() != null
                            && (existing.getAwayTeam().getId().equals(home.getId())
                                || away != null && existing.getAwayTeam().getId().equals(away.getId())));
            if (repeated) throw BusinessException.conflict("Un equipo ya está en otro cruce de la primera ronda");
        }
        if (request.matchDate() == null && !bracket) {
            throw BusinessException.badRequest("Indica la fecha del partido");
        }
        if (request.matchDate() != null && request.matchDate().isBefore(LocalDateTime.now().minusYears(1))) {
            throw BusinessException.badRequest("La fecha del partido no es válida");
        }
        Match match = matchRepository.save(Match.builder()
                .competition(competition).homeTeam(home).awayTeam(away)
                .matchDate(request.matchDate()).round(round)
                .groupName("group".equals(round) && edition.getPoolFormat() != com.porra.mundial.model.PoolFormat.MATCH_DAY
                        ? home.getGroupName() : null).build());
        scoreInvalidationService.invalidateCompetition(competition.getId());
        return MatchResponseDTO.fromEntity(match);
    }

    @Transactional
    @CacheEvict(value = {"matchRadar", "competitionStandings", "matchdayStats"}, allEntries = true)
    public MatchResponseDTO setResult(Long leagueId, Long matchId, String email, CustomResultRequest request) {
        Competition competition = ownedCompetition(leagueId, email);
        Match match = matchRepository.findById(matchId)
                .filter(m -> m.getCompetition() != null && competition.getId().equals(m.getCompetition().getId()))
                .orElseThrow(() -> BusinessException.notFound("Partido no encontrado"));
        if (match.getAwayTeam() == null) {
            throw BusinessException.badRequest("Un descanso no tiene resultado");
        }
        Team winner = request.homeScore() > request.awayScore() ? match.getHomeTeam()
                : request.awayScore() > request.homeScore() ? match.getAwayTeam() : null;
        if (request.winnerTeamId() != null) {
            if (match.getRound() == null || !match.getRound().startsWith("bracket-")) {
                throw BusinessException.badRequest("Solo las eliminatorias admiten ganador de desempate");
            }
            if (!request.winnerTeamId().equals(match.getHomeTeam().getId())
                    && !request.winnerTeamId().equals(match.getAwayTeam().getId())) {
                throw BusinessException.badRequest("El ganador no pertenece al partido");
            }
            if (winner != null && !request.winnerTeamId().equals(winner.getId())) {
                throw BusinessException.badRequest("El ganador contradice el marcador");
            }
            winner = request.winnerTeamId().equals(match.getHomeTeam().getId())
                    ? match.getHomeTeam() : match.getAwayTeam();
        }
        if (match.getRound() != null && match.getRound().startsWith("bracket-") && winner == null) {
            throw BusinessException.badRequest("Indica el ganador del empate");
        }
        match.setHomeScore(request.homeScore());
        match.setAwayScore(request.awayScore());
        match.setFinished(true);
        match.setStatus(MatchStatusNormalized.FINISHED);
        match.setWinnerTeam(winner);
        scoreInvalidationService.invalidateCompetition(competition.getId());
        return MatchResponseDTO.fromEntity(match);
    }

    @Transactional
    @CacheEvict(value = {"matches", "matchRadar", "competitionStandings", "matchdayStats"}, allEntries = true)
    public void deleteMatch(Long leagueId, Long matchId, String email) {
        Competition competition = ownedCompetition(leagueId, email);
        Match match = matchRepository.findById(matchId)
                .filter(candidate -> candidate.getCompetition() != null
                        && competition.getId().equals(candidate.getCompetition().getId()))
                .orElseThrow(() -> BusinessException.notFound("Partido no encontrado"));
        if ("bracket-1".equals(match.getRound())
                && !predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
            throw BusinessException.conflict("No se pueden cambiar los cruces después del primer pronóstico");
        }
        matchRepository.delete(match);
        scoreInvalidationService.invalidateCompetition(competition.getId());
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
