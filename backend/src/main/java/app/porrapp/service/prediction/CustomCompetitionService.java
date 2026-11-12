package app.porrapp.service.prediction;

import app.porrapp.service.tournament.CompetitionService;
import app.porrapp.dto.CustomMatchRequest;
import app.porrapp.dto.CustomResultRequest;
import app.porrapp.dto.MatchResponseDTO;
import app.porrapp.dto.LeagueStandingDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionTeam;
import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.Membership;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Team;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomCompetitionService {
    private final EditionRepository editionRepository;
    private final TeamRepository teamRepository;
    private final CompetitionTeamRepository competitionTeamRepository;
    private final MatchRepository matchRepository;
    private final ScoreInvalidationService scoreInvalidationService;
    private final MembershipRepository membershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final PredictionRepository predictionRepository;
    private final CompetitionService competitionService;
    private final CustomLockService lockService;

    private static final java.time.format.DateTimeFormatter FIRST_MATCH_FORMAT =
            java.time.format.DateTimeFormatter.ofPattern("d/M/yyyy HH:mm")
                    .withZone(java.time.ZoneId.of("Europe/Madrid"));

    /** Margen máximo antes del partido: 30 días. */
    static final int MAX_LOCK_OFFSET_MINUTES = 30 * 24 * 60;

    /** Cambia el cierre; si la nueva fecha es posterior, los pronósticos ya cerrados vuelven a abrirse. */
    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode"}, allEntries = true)
    public Edition setLockConfig(Long leagueId, String email, PredictionLockMode mode, Integer offsetMinutes,
                                 Instant lockDate) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (!edition.getLeague().isAdmin(email)) {
            throw BusinessException.forbidden("Solo el administrador puede cambiar el cierre");
        }
        if (mode == null) throw BusinessException.badRequest("Elige cómo se cierran las predicciones");
        if (app.porrapp.model.PoolFormat.isRaceBased(edition.getPoolFormat())) {
            throw BusinessException.badRequest("En Fórmula 1 cada Gran Premio se cierra al empezar la clasificación");
        }
        int offset = offsetMinutes == null ? 0 : offsetMinutes;
        if (offset < 0 || offset > MAX_LOCK_OFFSET_MINUTES) {
            throw BusinessException.badRequest("El margen debe estar entre 0 minutos y 30 días");
        }
        // Por jornadas y superviviente se pronostica partido a partido: se cierran igual.
        if (app.porrapp.model.PoolFormat.isMatchBased(edition.getPoolFormat())) {
            return setMatchdayLock(edition, mode, offset);
        }
        if (mode == PredictionLockMode.PER_DAY) {
            throw BusinessException.badRequest("El cierre por días es solo para ligas por jornadas");
        }
        if (DrawnKnockout.applies(edition) && !mode.progressive()) {
            // Las rondas siguientes aún no tienen cruces: no puede cerrarse todo a la vez.
            throw BusinessException.badRequest("Los cruces se sortean ronda a ronda: se cierra por rondas o por eliminatorias");
        }
        if (mode.progressive() && !PredictableBracket.applies(edition)) {
            throw BusinessException.badRequest("Esta competición solo admite cerrar en una fecha o en el primer partido");
        }
        Instant now = Instant.now();
        edition.setLockMode(mode);
        if (mode == PredictionLockMode.FIXED_DATE) {
            if (lockDate == null) {
                throw BusinessException.badRequest("Con el cierre en una fecha fija hace falta la fecha de cierre (lockDate)");
            }
            if (!lockDate.isAfter(now)) {
                throw BusinessException.badRequest("La fecha de cierre debe ser futura");
            }
            // Con el cierre después del primer cruce se rellenaría el cuadro sabiendo ya resultados.
            Instant firstMatch = lockService.bracketClosesAt(edition);
            if (firstMatch != null && lockDate.isAfter(firstMatch)) {
                throw BusinessException.badRequest("La fecha de cierre debe ser anterior al primer cruce ("
                        + FIRST_MATCH_FORMAT.format(firstMatch) + "): después ya se sabrían resultados");
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
        return edition;
    }

    /** Liga por jornadas: cada partido, cada día o cada jornada al empezar su primer partido, menos el margen. */
    private Edition setMatchdayLock(Edition edition, PredictionLockMode mode, int offset) {
        if (mode != PredictionLockMode.PER_MATCH && mode != PredictionLockMode.PER_DAY
                && mode != PredictionLockMode.PER_ROUND) {
            throw BusinessException.badRequest("Una liga por jornadas se cierra por partidos, por días o por jornadas");
        }
        edition.setLockMode(mode);
        edition.setLockOffsetMinutes(offset);
        // Cada partido se cierra por su cuenta: una fecha de cierre de antes cerraría toda la liga.
        edition.setLockDate(null);
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

    /** La liga pronostica los playoffs de la NBA, serie a serie. */
    @Transactional(readOnly = true)
    public boolean playsSeries(Long leagueId, String email) {
        return DrawnKnockout.playsSeries(memberEdition(leagueId, email));
    }

    /**
     * Cierre de un cuadro recién creado sin elegirlo: el de su primer partido con fecha. Si la competición ya
     * ha empezado, ese cierre habría pasado y hay que elegir otro; sin partidos aún, lo fija la sincronización.
     */
    @Transactional
    public void applyDefaultLock(Long leagueId) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE").orElse(null);
        if (edition == null || edition.getLockMode() != PredictionLockMode.FIRST_MATCH) return;
        Instant lock = lockService.firstMatchLock(edition);
        if (lock != null && !lock.isAfter(Instant.now())) {
            throw BusinessException.badRequest("La competición ya ha empezado: elige cómo se cierran las predicciones "
                    + "(lockMode) o una fecha de cierre futura (lockDate)");
        }
        edition.setLockDate(lock);
    }

    /** En el modo «primer partido» el cierre sigue al primer partido aunque cambie el calendario. */
    private void refreshFirstMatchLock(Long leagueId) {
        editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .filter(edition -> edition.getLockMode() == PredictionLockMode.FIRST_MATCH)
                .ifPresent(edition -> edition.setLockDate(lockService.firstMatchLock(edition)));
    }

    /** Equipo de una competición propia con el grupo de su participación, si juega fase de grupos. */
    public record GroupedTeam(Team team, String groupName) {
    }

    @Transactional(readOnly = true)
    public List<GroupedTeam> teams(Long leagueId, String email) {
        Competition competition = memberCompetition(leagueId, email);
        Map<Long, String> groups = competitionTeamRepository.groupByTeamId(competition.getId());
        return teamRepository.findByCompetitionIdOrderByNameAsc(competition.getId()).stream()
                .map(team -> new GroupedTeam(team, groups.get(team.getId()))).toList();
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
        boolean admin = edition.getLeague().isAdmin(email);
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
        return addTeam(leagueId, email, rawName, rawGroupName, null).team();
    }

    /** El grupo se guarda en la participación del equipo en la competición, no en el equipo. */
    @Transactional
    public GroupedTeam addTeam(Long leagueId, String email, String rawName, String rawGroupName, String rawLogoUrl) {
        Competition competition = ownedCompetition(leagueId, email);
        String logoUrl = logoUrl(rawLogoUrl);
        String name = rawName.trim();
        String groupName = rawGroupName == null ? null : rawGroupName.trim();
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getPoolFormat() != app.porrapp.model.PoolFormat.MATCH_DAY
                && predictionRepository.existsByEditionLeagueId(leagueId)) {
            throw BusinessException.conflict("No se pueden cambiar los equipos después de la primera predicción");
        }
        if (edition.getPoolFormat() == app.porrapp.model.PoolFormat.FULL_BRACKET) {
            if (groupName == null || groupName.isBlank() || groupName.length() > 50) {
                throw BusinessException.badRequest("Indica un grupo de hasta 50 caracteres");
            }
        } else if (groupName != null && !groupName.isBlank()) {
            throw BusinessException.badRequest("Este formato no tiene fase de grupos");
        }
        if (teamRepository.existsByCompetitionIdAndNameIgnoreCase(competition.getId(), name)) {
            throw BusinessException.conflict("Ya existe un equipo con ese nombre");
        }
        Team team = teamRepository.save(Team.builder().name(name).competition(competition).logoUrl(logoUrl).build());
        String group = groupName == null || groupName.isBlank() ? null : groupName;
        competitionTeamRepository.save(CompetitionTeam.builder().competition(competition).team(team)
                .groupName(group).build());
        return new GroupedTeam(team, group);
    }

    /** El escudo es solo estético: se puede cambiar aunque ya haya pronósticos. */
    @Transactional
    @CacheEvict(value = {"matches", "matchRadar"}, allEntries = true)
    public GroupedTeam setTeamLogo(Long leagueId, Long teamId, String email, String rawLogoUrl) {
        Competition competition = ownedCompetition(leagueId, email);
        Team selected = team(competition, teamId);
        selected.setLogoUrl(logoUrl(rawLogoUrl));
        return new GroupedTeam(selected, competitionTeamRepository.groupByTeamId(competition.getId()).get(teamId));
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
        if (predictionRepository.existsByEditionLeagueId(leagueId)) {
            throw BusinessException.conflict("No se pueden cambiar los equipos después de la primera predicción");
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
        if (edition.getPoolFormat() == app.porrapp.model.PoolFormat.MATCH_DAY) {
            if (bracket || away == null) throw BusinessException.badRequest("Esta liga se juega por jornadas");
        } else if (!bracket && !"group".equals(round)) {
            throw BusinessException.badRequest("Ronda no válida");
        }
        String homeGroup = null;
        if (!bracket && edition.getPoolFormat() != app.porrapp.model.PoolFormat.MATCH_DAY) {
            Map<Long, String> groups = competitionTeamRepository.groupByTeamId(competition.getId());
            homeGroup = groups.get(home.getId());
            if (edition.getPoolFormat() != app.porrapp.model.PoolFormat.FULL_BRACKET || away == null
                    || homeGroup == null || !homeGroup.equals(groups.get(away.getId()))) {
                throw BusinessException.badRequest("El partido de grupos requiere dos equipos del mismo grupo");
            }
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
            if (predictionRepository.existsByEditionLeagueId(leagueId)) {
                throw BusinessException.conflict("No se pueden cambiar los cruces después de la primera predicción");
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
        if (request.matchDate() != null && AppTime.fromLocal(request.matchDate()).isBefore(Instant.now().minus(365, ChronoUnit.DAYS))) {
            throw BusinessException.badRequest("La fecha del partido no es válida");
        }
        Match match = matchRepository.save(Match.builder()
                .competition(competition).homeTeam(home).awayTeam(away)
                .matchDate(AppTime.fromLocal(request.matchDate())).round(round)
                .groupName(homeGroup).build());
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
    public MatchResponseDTO setMatchDate(Long leagueId, Long matchId, String email, Instant date) {
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
        if (date != null && date.isBefore(Instant.now().minus(365, ChronoUnit.DAYS))) {
            throw BusinessException.badRequest("La fecha del partido no es válida");
        }
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        match.setMatchDate(date);
        refreshFirstMatchLock(leagueId);
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
                && predictionRepository.existsByEditionLeagueId(leagueId)) {
            throw BusinessException.conflict("No se pueden cambiar los cruces después de la primera predicción");
        }
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (predictionRepository.existsByEditionLeagueId(leagueId)) {
            PredictionLockMode mode = edition.getLockMode();
            if (mode != null && mode.progressive()) {
                CustomLockService.LockState before = lockService.state(edition);
                if (before.anyLocked() && reopensClosedParts(before, lockService.stateWithoutMatch(edition, matchId))) {
                    throw BusinessException.conflict("Ese partido mantiene cerradas predicciones que ya no se pueden reabrir");
                }
            } else if (mode == PredictionLockMode.FIRST_MATCH && edition.isLocked()) {
                Instant nextLock = lockService.firstMatchLockWithoutMatch(edition, matchId);
                if (nextLock == null || nextLock.isAfter(Instant.now())) {
                    throw BusinessException.conflict("Ese partido mantiene cerrado el plazo de predicciones");
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
        if (!edition.getLeague().isAdmin(email)) {
            throw BusinessException.forbidden("Solo el administrador puede editar esta competición");
        }
        Competition competition = edition.getCompetition();
        if (competition.getOwnerLeague() == null || !leagueId.equals(competition.getOwnerLeague().getId())) {
            throw BusinessException.badRequest("Esta liga no tiene una competición personalizada");
        }
        return competition;
    }
}
