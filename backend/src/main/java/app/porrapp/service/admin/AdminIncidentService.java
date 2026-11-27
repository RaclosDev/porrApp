package app.porrapp.service.admin;

import app.porrapp.dto.AdminIncidentDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.MatchSyncIncident;
import app.porrapp.model.MatchSyncIncident.Kind;
import app.porrapp.model.MatchSyncIncident.Status;
import app.porrapp.model.Team;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MatchSyncIncidentRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.service.notification.WebSocketService;
import app.porrapp.service.prediction.MatchPredictionService;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.sync.FightCardService;
import app.porrapp.service.sync.GroupTournamentTables;
import app.porrapp.service.sync.SyncLock;
import app.porrapp.service.tournament.KnockoutBracketService;
import app.porrapp.service.tournament.StandingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Incidencias de resultado del panel de administración: lo que la sincronización no ha aplicado solo y
 * el administrador de porrApp aplica o descarta.
 */
@Service
@Slf4j
public class AdminIncidentService {

    static final int RECENT_RESOLVED = 30;
    static final String SYNC_BUSY = "La sincronización está en marcha; vuelve a intentarlo en un momento";
    static final String ALREADY_RESOLVED = "Esta incidencia ya está resuelta";

    /** Lo mismo que espera la sincronización antes de aplicar sola un marcador o cancelar una pelea. */
    static final Duration CONFIRM_SCORE_AFTER = Duration.ofMinutes(10);
    static final Duration CONFIRM_FIGHT_MISSING_AFTER = Duration.ofMinutes(30);

    private static final List<Status> OPEN = List.of(Status.BLOCKED, Status.PENDING);

    private final MatchSyncIncidentRepository incidents;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final MatchPredictionService matchPredictionService;
    private final FightCardService fightCardService;
    private final ScoreInvalidationService scoreInvalidationService;
    private final WebSocketService webSocketService;
    private final KnockoutBracketService knockoutBracketService;
    private final StandingsService standingsService;
    private final SyncLock syncLock;
    private final TransactionTemplate transactions;
    private final Clock clock;

    @Autowired
    @SuppressWarnings("java:S107") // Aplicar un resultado toca lo mismo que la sincronización.
    public AdminIncidentService(MatchSyncIncidentRepository incidents, MatchRepository matchRepository,
                                TeamRepository teamRepository, MatchPredictionService matchPredictionService,
                                FightCardService fightCardService, ScoreInvalidationService scoreInvalidationService,
                                WebSocketService webSocketService, KnockoutBracketService knockoutBracketService,
                                StandingsService standingsService, SyncLock syncLock,
                                PlatformTransactionManager transactionManager) {
        this(incidents, matchRepository, teamRepository, matchPredictionService, fightCardService,
                scoreInvalidationService, webSocketService, knockoutBracketService, standingsService, syncLock,
                new TransactionTemplate(transactionManager), Clock.systemUTC());
    }

    @SuppressWarnings("java:S107")
    AdminIncidentService(MatchSyncIncidentRepository incidents, MatchRepository matchRepository,
                         TeamRepository teamRepository, MatchPredictionService matchPredictionService,
                         FightCardService fightCardService, ScoreInvalidationService scoreInvalidationService,
                         WebSocketService webSocketService, KnockoutBracketService knockoutBracketService,
                         StandingsService standingsService, SyncLock syncLock, TransactionTemplate transactions,
                         Clock clock) {
        this.incidents = incidents;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.matchPredictionService = matchPredictionService;
        this.fightCardService = fightCardService;
        this.scoreInvalidationService = scoreInvalidationService;
        this.webSocketService = webSocketService;
        this.knockoutBracketService = knockoutBracketService;
        this.standingsService = standingsService;
        this.syncLock = syncLock;
        this.transactions = transactions;
        this.clock = clock;
    }

    /** Las abiertas, de la más reciente a la más antigua, y después las últimas resueltas. */
    @Transactional(readOnly = true)
    public List<AdminIncidentDTO> list() {
        List<MatchSyncIncident> rows = new ArrayList<>(incidents.findByStatusInOrderByLastSeenAtDesc(OPEN));
        rows.addAll(incidents.findRecentlyResolved(OPEN, PageRequest.of(0, RECENT_RESOLVED)));
        if (rows.isEmpty()) return List.of();
        Map<Long, Match> matches = matchRepository.findAllById(
                rows.stream().map(MatchSyncIncident::getMatchId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Match::getId, Function.identity()));
        Set<Long> winnerIds = new HashSet<>();
        for (MatchSyncIncident row : rows) {
            if (row.getPreviousWinnerTeamId() != null) winnerIds.add(row.getPreviousWinnerTeamId());
            if (row.getReceivedWinnerTeamId() != null) winnerIds.add(row.getReceivedWinnerTeamId());
        }
        Map<Long, String> teamNames = winnerIds.isEmpty() ? Map.of() : teamRepository.findAllById(winnerIds).stream()
                .collect(Collectors.toMap(Team::getId, AdminIncidentService::name));
        return rows.stream().map(row -> toDto(row, matches.get(row.getMatchId()), teamNames)).toList();
    }

    /**
     * Aplica lo que mandó el proveedor: el marcador y el estado recibidos, o la cancelación de la pelea.
     * Espera a que termine la pasada de sincronización en marcha para no pisarse con ella.
     */
    public AdminIncidentDTO apply(Long incidentId) {
        Applied applied = underSyncLock(() -> transactions.execute(status -> applyNow(incidentId)));
        if (applied.competition() != null) refreshCompetition(applied.competition());
        return applied.incident();
    }

    /** Deja el resultado guardado y no vuelve a avisar mientras el proveedor mande lo mismo. */
    public AdminIncidentDTO dismiss(Long incidentId) {
        return underSyncLock(() -> transactions.execute(status -> {
            MatchSyncIncident incident = lockOpen(incidentId);
            resolve(incident, Status.DISMISSED);
            log.info("El administrador descarta la incidencia {} del partido {}", incident.getId(), incident.getMatchId());
            return toDto(incident, matchRepository.findById(incident.getMatchId()).orElse(null), Map.of());
        }));
    }

    private Applied applyNow(Long incidentId) {
        MatchSyncIncident incident = lockOpen(incidentId);
        Match match = matchRepository.findById(incident.getMatchId())
                .orElseThrow(() -> BusinessException.notFound("El partido ya no existe"));
        if (incident.getKind() == Kind.FIGHT_MISSING) {
            if (!Boolean.TRUE.equals(match.getFinished()) && match.getStatus() != MatchStatusNormalized.CANCELLED) {
                fightCardService.cancelFightByAdmin(match);
            }
        } else {
            applyReceived(match, incident);
        }
        resolve(incident, Status.APPLIED);
        log.info("El administrador aplica la incidencia {} ({}) del partido {}", incident.getId(), incident.getKind(),
                match.getId());
        // Fuera de la transacción la competición perezosa ya no se podría leer.
        Competition competition = match.getCompetition() == null ? null
                : org.hibernate.Hibernate.unproxy(match.getCompetition(), Competition.class);
        return new Applied(toDto(incident, match, Map.of()), competition);
    }

    private void applyReceived(Match match, MatchSyncIncident incident) {
        MatchStatusNormalized status = incident.getReceivedStatus() == null
                ? MatchStatusNormalized.SCHEDULED : incident.getReceivedStatus();
        match.setHomeScore(incident.getReceivedHomeScore());
        match.setAwayScore(incident.getReceivedAwayScore());
        match.setWinnerTeam(incident.getReceivedWinnerTeamId() == null ? null
                : teamRepository.findById(incident.getReceivedWinnerTeamId()).orElse(null));
        match.setStatus(status);
        match.setFinished(status == MatchStatusNormalized.FINISHED);
        if (!status.isLive() && status != MatchStatusNormalized.FINISHED) match.setDisplayClock(null);
        matchRepository.save(match);
        if (status == MatchStatusNormalized.FINISHED || status.isLive()) {
            matchPredictionService.evaluatePredictionsForMatch(match);
        } else {
            // Vuelve a estar sin jugar: los puntos de ese partido dejan de contar.
            matchPredictionService.clearMatchPoints(match);
        }
    }

    /** Lo que hace la sincronización cuando cambia un resultado: tablas, clasificaciones y aviso a las pantallas. */
    private void refreshCompetition(Competition competition) {
        scoreInvalidationService.invalidateCompetition(competition.getId());
        if (GroupTournamentTables.applies(competition)) {
            GroupTournamentTables.refresh(competition, knockoutBracketService, standingsService);
            webSocketService.notifyResultsChanged();
        } else {
            webSocketService.notifyResultsChanged(List.of(competition.getId()));
        }
    }

    private MatchSyncIncident lockOpen(Long incidentId) {
        MatchSyncIncident incident = incidents.findByIdForUpdate(incidentId)
                .orElseThrow(() -> BusinessException.notFound("Incidencia no encontrada"));
        if (!incident.isOpen()) throw BusinessException.conflict(ALREADY_RESOLVED);
        return incident;
    }

    private void resolve(MatchSyncIncident incident, Status status) {
        incident.setStatus(status);
        incident.setResolvedAt(clock.instant());
        incident.setResolvedBy(MatchSyncIncident.BY_ADMIN);
        incidents.save(incident);
    }

    private <T> T underSyncLock(java.util.function.Supplier<T> work) {
        boolean locked;
        try {
            locked = syncLock.tryLock(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw BusinessException.conflict(SYNC_BUSY);
        }
        if (!locked) throw BusinessException.conflict(SYNC_BUSY);
        try {
            return work.get();
        } finally {
            syncLock.unlock();
        }
    }

    private AdminIncidentDTO toDto(MatchSyncIncident row, Match match, Map<Long, String> teamNames) {
        Competition competition = match == null ? null : match.getCompetition();
        return new AdminIncidentDTO(
                row.getId(),
                row.getKind().name(),
                row.getStatus().name(),
                row.getMatchId(),
                match == null ? null : name(match.getHomeTeam()) + " - " + name(match.getAwayTeam()),
                competition == null ? null : competition.getName(),
                match == null ? null : match.getMatchDate(),
                new AdminIncidentDTO.Side(statusLabel(row.getPreviousStatus()), row.getPreviousHomeScore(),
                        row.getPreviousAwayScore(), winner(row.getPreviousWinnerTeamId(), match, teamNames)),
                new AdminIncidentDTO.Side(statusLabel(row.getReceivedStatus()), row.getReceivedHomeScore(),
                        row.getReceivedAwayScore(), winner(row.getReceivedWinnerTeamId(), match, teamNames)),
                row.getFirstSeenAt(),
                row.getLastSeenAt(),
                row.getSeenCount(),
                autoApplyAt(row),
                row.getResolvedAt(),
                row.getResolvedBy());
    }

    /** Las vueltas atrás no se aplican nunca solas; el resto, si el proveedor lo repite pasado el plazo. */
    static Instant autoApplyAt(MatchSyncIncident row) {
        if (row.getStatus() != Status.PENDING || row.getFirstSeenAt() == null) return null;
        return row.getFirstSeenAt().plus(row.getKind() == Kind.FIGHT_MISSING
                ? CONFIRM_FIGHT_MISSING_AFTER : CONFIRM_SCORE_AFTER);
    }

    private static String winner(Long teamId, Match match, Map<Long, String> teamNames) {
        if (teamId == null) return null;
        if (match != null) {
            if (match.getHomeTeam() != null && Objects.equals(match.getHomeTeam().getId(), teamId)) {
                return name(match.getHomeTeam());
            }
            if (match.getAwayTeam() != null && Objects.equals(match.getAwayTeam().getId(), teamId)) {
                return name(match.getAwayTeam());
            }
        }
        return teamNames.getOrDefault(teamId, Team.PLACEHOLDER_NAME);
    }

    private static String name(Team team) {
        return team == null || team.getName() == null ? Team.PLACEHOLDER_NAME : team.getName();
    }

    /** El estado del partido en palabras, para el panel y el aviso. */
    public static String statusLabel(MatchStatusNormalized status) {
        if (status == null) return "sin estado";
        return switch (status) {
            case SCHEDULED -> "sin empezar";
            case LIVE -> "en directo";
            case PAUSED -> "en el descanso";
            case FINISHED -> "terminado";
            case POSTPONED -> "aplazado";
            case CANCELLED -> "cancelado";
            case ABANDONED -> "abandonado";
            case SUSPENDED -> "suspendido";
        };
    }

    private record Applied(AdminIncidentDTO incident, Competition competition) {
    }
}
