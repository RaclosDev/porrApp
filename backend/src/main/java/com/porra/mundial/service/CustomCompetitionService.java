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
import com.porra.mundial.model.PredictionLockMode;
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
import java.util.Map;

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
    private final CustomLockService lockService;

    /** Margen máximo antes del partido: 30 días. */
    static final int MAX_LOCK_OFFSET_MINUTES = 30 * 24 * 60;

    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode"}, allEntries = true)
    public LocalDateTime setLockDate(Long leagueId, String email, LocalDateTime lockDate) {
        return setLockConfig(leagueId, email, PredictionLockMode.FIXED_DATE, 0, lockDate).getLockDate();
    }

    /** Cambia el cierre sin volver a abrir partes ya cerradas de pronósticos existentes. */
    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode"}, allEntries = true)
    public Edition setLockConfig(Long leagueId, String email, PredictionLockMode mode, Integer offsetMinutes,
                                 LocalDateTime lockDate) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getLeague().getAdminUser() == null
                || !email.equalsIgnoreCase(edition.getLeague().getAdminUser().getGoogleEmail())) {
            throw BusinessException.forbidden("Solo el administrador puede cambiar el cierre");
        }
        if (mode == null) throw BusinessException.badRequest("Elige cómo se cierran los pronósticos");
        int offset = offsetMinutes == null ? 0 : offsetMinutes;
        if (offset < 0 || offset > MAX_LOCK_OFFSET_MINUTES) {
            throw BusinessException.badRequest("El margen debe estar entre 0 minutos y 30 días");
        }
        if (edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.MATCH_DAY) {
            return setMatchdayLock(edition, mode, offset);
        }
        if (mode == PredictionLockMode.PER_DAY) {
            throw BusinessException.badRequest("El cierre por días es solo para ligas por jornadas");
        }
        if (mode.progressive() && !PredictableBracket.applies(edition)) {
            throw BusinessException.badRequest("Esta competición solo admite cerrar en una fecha o en el primer partido");
        }
        boolean hasPredictions = !predictionRepository.findByEditionLeagueId(leagueId).isEmpty();
        CustomLockService.LockState previousState = hasPredictions ? lockService.state(edition) : null;
        PredictionLockMode previousMode = edition.getLockMode();
        int previousOffset = edition.getLockOffsetMinutes();
        LocalDateTime previousDate = edition.getLockDate();
        LocalDateTime now = LocalDateTime.now(CustomLockService.ZONE);
        edition.setLockMode(mode);
        if (mode == PredictionLockMode.FIXED_DATE) {
            if (lockDate == null || !lockDate.isAfter(now)) {
                throw BusinessException.badRequest("La fecha de cierre debe ser futura");
            }
            edition.setLockOffsetMinutes(0);
            edition.setLockDate(lockDate);
        } else {
            edition.setLockOffsetMinutes(offset);
            edition.setLockDate(mode == PredictionLockMode.FIRST_MATCH ? lockService.firstMatchLock(edition) : null);
            if (mode == PredictionLockMode.FIRST_MATCH && edition.getLockDate() != null
                    && !edition.getLockDate().isAfter(now)) {
                throw BusinessException.badRequest("Con ese margen el cierre ya habría pasado");
            }
        }
        if (previousState != null && previousState.anyLocked()
                && reopensClosedParts(previousState, lockService.state(edition))) {
            edition.setLockMode(previousMode);
            edition.setLockOffsetMinutes(previousOffset);
            edition.setLockDate(previousDate);
            throw BusinessException.conflict("El nuevo cierre volvería a abrir pronósticos que ya estaban cerrados");
        }
        return edition;
    }

    /**
     * Liga por jornadas: cada partido, cada día o cada jornada al empezar su primer partido, menos el margen.
     * No se puede volver a abrir un partido que ya estaba cerrado.
     */
    private Edition setMatchdayLock(Edition edition, PredictionLockMode mode, int offset) {
        if (mode != PredictionLockMode.PER_MATCH && mode != PredictionLockMode.PER_DAY
                && mode != PredictionLockMode.PER_ROUND) {
            throw BusinessException.badRequest("Una liga por jornadas se cierra por partidos, por días o por jornadas");
        }
        PredictionLockMode previousMode = edition.getLockMode();
        int previousOffset = edition.getLockOffsetMinutes();
        if (edition.getCompetition() != null
                && !predictionRepository.findByEditionLeagueId(edition.getLeague().getId()).isEmpty()) {
            List<Match> calendar = matchRepository.findByCompetitionId(edition.getCompetition().getId());
            LocalDateTime now = LocalDateTime.now();
            Map<Long, LocalDateTime> before = MatchdayLock.lockTimes(edition, calendar, calendar);
            edition.setLockMode(mode);
            edition.setLockOffsetMinutes(offset);
            Map<Long, LocalDateTime> after = MatchdayLock.lockTimes(edition, calendar, calendar);
            boolean reopens = calendar.stream().anyMatch(match -> !Boolean.TRUE.equals(match.getFinished())
                    && before.containsKey(match.getId()) && !before.get(match.getId()).isAfter(now)
                    && after.get(match.getId()).isAfter(now));
            if (reopens) {
                edition.setLockMode(previousMode);
                edition.setLockOffsetMinutes(previousOffset);
                throw BusinessException.conflict("El nuevo cierre volvería a abrir pronósticos que ya estaban cerrados");
            }
        }
        edition.setLockMode(mode);
        edition.setLockOffsetMinutes(offset);
        return edition;
    }

    private static boolean reopensClosedParts(CustomLockService.LockState before, CustomLockService.LockState after) {
        if (before.fullyLocked() && !after.fullyLocked()) return true;
        for (String group : before.groups()) {
            if (!after.groupLocked(group)) return true;
        }
        for (int round = 0; round < before.picks().size(); round++) {
            for (int index = 0; index < before.picks().get(round).size(); index++) {
                if (before.pickLocked(round, index) && !after.pickLocked(round, index)) return true;
            }
        }
        return false;
    }

    /** Estado del cierre para los miembros: qué grupos y ganadores siguen abiertos. */
    @Transactional(readOnly = true)
    public CustomLockService.LockState lockState(Long leagueId, String email) {
        return lockService.state(memberEdition(leagueId, email));
    }

    /** En el modo «primer partido» el cierre sigue al primer partido aunque cambie el calendario. */
    private void refreshFirstMatchLock(Long leagueId) {
        editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .filter(edition -> edition.getLockMode() == PredictionLockMode.FIRST_MATCH)
                .ifPresent(edition -> edition.setLockDate(lockService.firstMatchLock(edition)));
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
        Edition edition = memberEdition(leagueId, email);
        Competition competition = edition.getCompetition();
        if (competition == null || competition.getOwnerLeague() == null
                || !leagueId.equals(competition.getOwnerLeague().getId())) {
            throw BusinessException.notFound("Competición personalizada no encontrada");
        }
        return competition;
    }

    /** Edición activa de una liga a la que pertenece el usuario (o que administra). */
    private Edition memberEdition(Long leagueId, String email) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        boolean admin = edition.getLeague().getAdminUser() != null
                && email.equalsIgnoreCase(edition.getLeague().getAdminUser().getGoogleEmail());
        boolean member = userAccountRepository.findByGoogleEmail(email)
                .map(user -> membershipRepository.existsById(new Membership.MembershipId(user.getId(), leagueId)))
                .orElse(false);
        if (!admin && !member) throw BusinessException.forbidden("No perteneces a esta liga");
        return edition;
    }

    @Transactional
    public Team addTeam(Long leagueId, String email, String rawName) {
        return addTeam(leagueId, email, rawName, null);
    }

    @Transactional
    public Team addTeam(Long leagueId, String email, String rawName, String rawGroupName) {
        return addTeam(leagueId, email, rawName, rawGroupName, null);
    }

    @Transactional
    public Team addTeam(Long leagueId, String email, String rawName, String rawGroupName, String rawLogoUrl) {
        Competition competition = ownedCompetition(leagueId, email);
        String logoUrl = logoUrl(rawLogoUrl);
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
                .groupName(groupName == null || groupName.isBlank() ? null : groupName)
                .logoUrl(logoUrl).build());
    }

    /** El escudo es solo estético: se puede cambiar aunque ya haya pronósticos. */
    @Transactional
    @CacheEvict(value = {"matches", "matchRadar"}, allEntries = true)
    public Team setTeamLogo(Long leagueId, Long teamId, String email, String rawLogoUrl) {
        Team selected = team(ownedCompetition(leagueId, email), teamId);
        selected.setLogoUrl(logoUrl(rawLogoUrl));
        return selected;
    }

    /** Solo direcciones https absolutas; vacío quita el escudo. */
    private static String logoUrl(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        try {
            java.net.URI uri = new java.net.URI(value);
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && value.length() <= 500) {
                return value;
            }
        } catch (java.net.URISyntaxException ignored) {
            // Se rechaza abajo con el mismo mensaje.
        }
        throw BusinessException.badRequest("El escudo debe ser una dirección https de hasta 500 caracteres");
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
    @CacheEvict(value = {"matches", "matchRadar", "competitionStandings", "userGroups", "groupById", "groupByCode"}, allEntries = true)
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
        List<Match> configuredMatches = bracket ? matchRepository.findByCompetitionId(competition.getId()) : List.of();
        boolean repeated = configuredMatches.stream()
                .filter(existing -> round.equals(existing.getRound()))
                .anyMatch(existing -> existing.getHomeTeam() != null
                        && (existing.getHomeTeam().getId().equals(home.getId())
                            || away != null && existing.getHomeTeam().getId().equals(away.getId()))
                        || existing.getAwayTeam() != null
                        && (existing.getAwayTeam().getId().equals(home.getId())
                            || away != null && existing.getAwayTeam().getId().equals(away.getId())));
        if (repeated) throw BusinessException.conflict("Un equipo ya está en otro cruce de esta ronda");
        if ("bracket-1".equals(round)) {
            if (!predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
                throw BusinessException.conflict("No se pueden cambiar los cruces después del primer pronóstico");
            }
        } else if (bracket) {
            int remaining = (int) configuredMatches.stream()
                    .filter(existing -> "bracket-1".equals(existing.getRound())).count();
            int roundNumber = Integer.parseInt(round.substring("bracket-".length()));
            for (int number = 2; number <= roundNumber; number++) {
                if (remaining <= 1) {
                    throw BusinessException.badRequest("Esa ronda no cabe en el cuadro configurado");
                }
                remaining = (remaining + 1) / 2;
            }
            long created = configuredMatches.stream().filter(existing -> round.equals(existing.getRound())).count();
            if (created >= remaining) {
                throw BusinessException.conflict("La ronda ya tiene todos sus cruces");
            }
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
        refreshFirstMatchLock(leagueId);
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
    @CacheEvict(value = {"matches", "matchRadar", "matchdayStats", "userGroups", "groupById", "groupByCode"}, allEntries = true)
    public MatchResponseDTO setMatchDate(Long leagueId, Long matchId, String email, LocalDateTime date) {
        Competition competition = ownedCompetition(leagueId, email);
        Match match = matchRepository.findById(matchId)
                .filter(candidate -> candidate.getCompetition() != null
                        && competition.getId().equals(candidate.getCompetition().getId()))
                .orElseThrow(() -> BusinessException.notFound("Partido no encontrado"));
        if (Boolean.TRUE.equals(match.getFinished())) {
            throw BusinessException.conflict("No se puede cambiar la fecha de un partido finalizado");
        }
        if (match.getAwayTeam() == null) {
            throw BusinessException.badRequest("Un descanso no necesita fecha");
        }
        if (date == null && (match.getRound() == null || !match.getRound().startsWith("bracket-"))) {
            throw BusinessException.badRequest("Indica la fecha del partido");
        }
        if (date != null && date.isBefore(LocalDateTime.now(CustomLockService.ZONE).minusYears(1))) {
            throw BusinessException.badRequest("La fecha del partido no es válida");
        }
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        boolean hasPredictions = !predictionRepository.findByEditionLeagueId(leagueId).isEmpty();
        CustomLockService.LockState before = hasPredictions ? lockService.state(edition) : null;
        LocalDateTime previousDate = match.getMatchDate();
        LocalDateTime previousLockDate = edition.getLockDate();
        match.setMatchDate(date);
        refreshFirstMatchLock(leagueId);
        if (before != null && before.anyLocked() && reopensClosedParts(before, lockService.state(edition))) {
            match.setMatchDate(previousDate);
            edition.setLockDate(previousLockDate);
            throw BusinessException.conflict("La nueva fecha volvería a abrir pronósticos ya cerrados");
        }
        scoreInvalidationService.invalidateCompetition(competition.getId());
        return MatchResponseDTO.fromEntity(match);
    }

    @Transactional
    @CacheEvict(value = {"matches", "matchRadar", "competitionStandings", "matchdayStats", "userGroups", "groupById", "groupByCode"}, allEntries = true)
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
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (!predictionRepository.findByEditionLeagueId(leagueId).isEmpty()) {
            PredictionLockMode mode = edition.getLockMode();
            if (mode != null && mode.progressive()) {
                CustomLockService.LockState before = lockService.state(edition);
                if (before.anyLocked() && reopensClosedParts(before, lockService.stateWithoutMatch(edition, matchId))) {
                    throw BusinessException.conflict("Ese partido mantiene cerrados pronósticos que ya no se pueden reabrir");
                }
            } else if (mode == PredictionLockMode.FIRST_MATCH && edition.isLocked()) {
                LocalDateTime nextLock = lockService.firstMatchLockWithoutMatch(edition, matchId);
                if (nextLock == null || nextLock.isAfter(LocalDateTime.now(CustomLockService.ZONE))) {
                    throw BusinessException.conflict("Ese partido mantiene cerrado el plazo de pronósticos");
                }
            }
        }
        matchRepository.delete(match);
        refreshFirstMatchLock(leagueId);
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
