package app.porrapp.service.sync;

import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.MatchSyncIncident;
import app.porrapp.model.MatchSyncIncident.Kind;
import app.porrapp.model.MatchSyncIncident.Status;
import app.porrapp.model.Team;
import app.porrapp.repository.MatchSyncIncidentRepository;
import app.porrapp.service.notification.MatchSyncIncidentOpenedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * Filtro de la sincronización para los resultados que ya están cerrados.
 * <ul>
 *   <li>Un partido terminado nunca vuelve atrás solo: si el proveedor lo devuelve sin acabar o sin marcador,
 *       se mantiene el resultado guardado y queda una incidencia bloqueada que solo aplica el administrador.</li>
 *   <li>Un marcador final distinto se retiene hasta que el proveedor lo repite pasados
 *       {@link #CONFIRM_SCORE_AFTER}; entonces se aplica solo. Si vuelve al marcador guardado, se descarta.</li>
 *   <li>Una pelea que falta de la cartelera se cancela cuando sigue faltando pasados
 *       {@link #CONFIRM_FIGHT_MISSING_AFTER}.</li>
 * </ul>
 * Lo que el administrador descarta se sigue reteniendo sin volver a avisar mientras el proveedor mande lo mismo.
 */
@Service
@Slf4j
public class MatchResultGuard {

    static final Duration CONFIRM_SCORE_AFTER = Duration.ofMinutes(10);
    static final Duration CONFIRM_FIGHT_MISSING_AFTER = Duration.ofMinutes(30);

    private static final List<Status> OPEN = List.of(Status.BLOCKED, Status.PENDING);

    private final MatchSyncIncidentRepository incidents;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Autowired
    public MatchResultGuard(MatchSyncIncidentRepository incidents, ApplicationEventPublisher events) {
        this(incidents, events, Clock.systemUTC());
    }

    MatchResultGuard(MatchSyncIncidentRepository incidents, ApplicationEventPublisher events, Clock clock) {
        this.incidents = incidents;
        this.events = events;
        this.clock = clock;
    }

    /**
     * Revisa lo que manda el proveedor para un partido ya guardado.
     *
     * @return true si hay que mantener el resultado guardado e ignorar el recibido
     */
    public boolean holdsResult(Match match, Integer home, Integer away, Team winner, MatchStatusNormalized received) {
        if (match == null || match.getId() == null || !Boolean.TRUE.equals(match.getFinished())) return false;
        boolean storedComplete = match.getHomeScore() != null && match.getAwayScore() != null;
        boolean receivedComplete = home != null && away != null;
        Long winnerId = id(winner);

        if (received != MatchStatusNormalized.FINISHED || (storedComplete && !receivedComplete)) {
            open(match, Kind.REGRESSION, Status.BLOCKED, received, home, away, winnerId);
            return true;
        }
        // Vuelve a estar terminado con marcador: lo que pareciera una vuelta atrás ya no lo es.
        close(match.getId(), Kind.REGRESSION);
        if (sameResult(match, home, away, winnerId)) {
            close(match.getId(), Kind.SCORE_CHANGE);
            return false;
        }
        MatchSyncIncident pending = open(match, Kind.SCORE_CHANGE, Status.PENDING, received, home, away, winnerId);
        if (pending == null) return true;
        Instant now = clock.instant();
        if (pending.getSeenCount() >= 2 && !pending.getFirstSeenAt().isAfter(now.minus(CONFIRM_SCORE_AFTER))) {
            resolve(pending, Status.APPLIED, MatchSyncIncident.BY_AUTO, now);
            log.info("Marcador final corregido y confirmado en el partido {}: {}-{} pasa a {}-{}", match.getId(),
                    match.getHomeScore(), match.getAwayScore(), home, away);
            return false;
        }
        return true;
    }

    /**
     * Una pelea que ya no sale en la cartelera de su velada.
     *
     * @return true si ya se ha confirmado y hay que cancelarla ahora
     */
    public boolean confirmsFightMissing(Match match) {
        MatchSyncIncident incident = open(match, Kind.FIGHT_MISSING, Status.PENDING, MatchStatusNormalized.CANCELLED,
                null, null, null);
        if (incident == null) return false;
        Instant now = clock.instant();
        if (incident.getSeenCount() >= 2
                && !incident.getFirstSeenAt().isAfter(now.minus(CONFIRM_FIGHT_MISSING_AFTER))) {
            resolve(incident, Status.APPLIED, MatchSyncIncident.BY_AUTO, now);
            return true;
        }
        return false;
    }

    /** Las peleas que vuelven a estar en la cartelera ya no faltan. */
    public void fightsBackOnCard(Collection<Long> matchIds) {
        if (matchIds == null || matchIds.isEmpty()) return;
        Instant now = clock.instant();
        for (MatchSyncIncident incident : incidents.findByMatchIdInAndKindAndStatusIn(matchIds, Kind.FIGHT_MISSING, OPEN)) {
            resolve(incident, Status.DISMISSED, MatchSyncIncident.BY_AUTO, now);
        }
    }

    /**
     * Abre la incidencia o actualiza la abierta. Si los datos recibidos cambian, la espera vuelve a empezar.
     *
     * @return la incidencia abierta, o null si el administrador ya descartó exactamente esto
     */
    private MatchSyncIncident open(Match match, Kind kind, Status status, MatchStatusNormalized received,
                                   Integer home, Integer away, Long winnerId) {
        Instant now = clock.instant();
        MatchSyncIncident last = incidents.findFirstByMatchIdAndKindOrderByIdDesc(match.getId(), kind).orElse(null);
        if (last != null && last.isOpen()) {
            if (sameReceived(last, received, home, away, winnerId)) {
                last.setSeenCount(last.getSeenCount() + 1);
            } else {
                setReceived(last, received, home, away, winnerId);
                last.setFirstSeenAt(now);
                last.setSeenCount(1);
            }
            last.setLastSeenAt(now);
            return incidents.save(last);
        }
        if (last != null && last.getStatus() == Status.DISMISSED
                && MatchSyncIncident.BY_ADMIN.equals(last.getResolvedBy())
                && sameReceived(last, received, home, away, winnerId) && samePrevious(last, match)) {
            last.setSeenCount(last.getSeenCount() + 1);
            last.setLastSeenAt(now);
            incidents.save(last);
            return null;
        }
        MatchSyncIncident incident = new MatchSyncIncident();
        incident.setMatchId(match.getId());
        incident.setKind(kind);
        incident.setStatus(status);
        incident.setPreviousStatus(match.getStatus());
        incident.setPreviousHomeScore(match.getHomeScore());
        incident.setPreviousAwayScore(match.getAwayScore());
        incident.setPreviousWinnerTeamId(id(match.getWinnerTeam()));
        setReceived(incident, received, home, away, winnerId);
        incident.setFirstSeenAt(now);
        incident.setLastSeenAt(now);
        incident.setSeenCount(1);
        MatchSyncIncident saved = incidents.save(incident);
        log.warn("Incidencia de resultado {} en el partido {}: {} {}-{} recibido como {} {}-{}", kind, match.getId(),
                match.getStatus(), match.getHomeScore(), match.getAwayScore(), received, home, away);
        // Las peleas que faltan solo salen en el panel; lo que toca un resultado cerrado se avisa.
        if (kind != Kind.FIGHT_MISSING) events.publishEvent(new MatchSyncIncidentOpenedEvent(saved.getId()));
        return saved;
    }

    private void close(Long matchId, Kind kind) {
        incidents.findFirstByMatchIdAndKindOrderByIdDesc(matchId, kind)
                .filter(MatchSyncIncident::isOpen)
                .ifPresent(incident -> resolve(incident, Status.DISMISSED, MatchSyncIncident.BY_AUTO, clock.instant()));
    }

    private void resolve(MatchSyncIncident incident, Status status, String by, Instant now) {
        incident.setStatus(status);
        incident.setResolvedAt(now);
        incident.setResolvedBy(by);
        incidents.save(incident);
    }

    /** Mismo marcador; un ganador que no llega no cuenta como cambio si el marcador es el mismo. */
    private static boolean sameResult(Match match, Integer home, Integer away, Long winnerId) {
        return Objects.equals(match.getHomeScore(), home) && Objects.equals(match.getAwayScore(), away)
                && (winnerId == null || match.getWinnerTeam() == null
                        || Objects.equals(id(match.getWinnerTeam()), winnerId));
    }

    private static boolean sameReceived(MatchSyncIncident incident, MatchStatusNormalized status, Integer home,
                                        Integer away, Long winnerId) {
        return incident.getReceivedStatus() == status && Objects.equals(incident.getReceivedHomeScore(), home)
                && Objects.equals(incident.getReceivedAwayScore(), away)
                && Objects.equals(incident.getReceivedWinnerTeamId(), winnerId);
    }

    private static boolean samePrevious(MatchSyncIncident incident, Match match) {
        return incident.getPreviousStatus() == match.getStatus()
                && Objects.equals(incident.getPreviousHomeScore(), match.getHomeScore())
                && Objects.equals(incident.getPreviousAwayScore(), match.getAwayScore())
                && Objects.equals(incident.getPreviousWinnerTeamId(), id(match.getWinnerTeam()));
    }

    private static void setReceived(MatchSyncIncident incident, MatchStatusNormalized status, Integer home,
                                    Integer away, Long winnerId) {
        incident.setReceivedStatus(status);
        incident.setReceivedHomeScore(home);
        incident.setReceivedAwayScore(away);
        incident.setReceivedWinnerTeamId(winnerId);
    }

    private static Long id(Team team) {
        return team == null ? null : team.getId();
    }
}
