package app.porrapp.service.sync;

import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.MatchSyncIncident;
import app.porrapp.model.MatchSyncIncident.Kind;
import app.porrapp.model.MatchSyncIncident.Status;
import app.porrapp.repository.MatchSyncIncidentRepository;
import app.porrapp.service.notification.MatchSyncIncidentOpenedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class MatchResultGuardTest {

    private final List<MatchSyncIncident> store = new ArrayList<>();
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final MutableClock clock = new MutableClock(Instant.parse("2026-06-15T21:00:00Z"));
    private MatchResultGuard guard;
    private Match match;

    @BeforeEach
    void setUp() {
        MatchSyncIncidentRepository incidents = mock(MatchSyncIncidentRepository.class);
        when(incidents.save(any())).thenAnswer(inv -> {
            MatchSyncIncident incident = inv.getArgument(0);
            if (incident.getId() == null) {
                incident.setId((long) store.size() + 1);
                store.add(incident);
            }
            return incident;
        });
        when(incidents.findFirstByMatchIdAndKindOrderByIdDesc(anyLong(), any())).thenAnswer(inv -> store.stream()
                .filter(i -> i.getMatchId().equals(inv.getArgument(0)) && i.getKind() == inv.getArgument(1))
                .max(Comparator.comparing(MatchSyncIncident::getId)));
        when(incidents.findByMatchIdInAndKindAndStatusIn(anyCollection(), any(), anyCollection())).thenAnswer(inv -> {
            Collection<Long> ids = inv.getArgument(0);
            Collection<Status> statuses = inv.getArgument(2);
            return store.stream().filter(i -> ids.contains(i.getMatchId()) && i.getKind() == inv.getArgument(1)
                    && statuses.contains(i.getStatus())).toList();
        });
        guard = new MatchResultGuard(incidents, events, clock);
        match = Match.builder().id(10L).homeScore(2).awayScore(1).finished(true)
                .status(MatchStatusNormalized.FINISHED).build();
    }

    private MatchSyncIncident only(Kind kind) {
        List<MatchSyncIncident> found = store.stream().filter(i -> i.getKind() == kind).toList();
        assertEquals(1, found.size(), "una sola incidencia " + kind);
        return found.get(0);
    }

    @Test
    @DisplayName("Un partido sin terminar no pasa por la guarda")
    void ignoresMatchesThatAreNotFinished() {
        match.setFinished(false);
        assertFalse(guard.holdsResult(match, null, null, null, MatchStatusNormalized.SCHEDULED));
        assertTrue(store.isEmpty());
    }

    @Test
    @DisplayName("Un partido terminado que vuelve sin acabar se bloquea y avisa al administrador una vez")
    void blocksARegressionAndAlertsOnce() {
        assertTrue(guard.holdsResult(match, null, null, null, MatchStatusNormalized.SCHEDULED));
        clock.advance(Duration.ofHours(2));
        assertTrue(guard.holdsResult(match, null, null, null, MatchStatusNormalized.SCHEDULED));

        MatchSyncIncident incident = only(Kind.REGRESSION);
        assertEquals(Status.BLOCKED, incident.getStatus(), "una vuelta atrás nunca se aplica sola");
        assertEquals(2, incident.getSeenCount());
        assertEquals(2, incident.getPreviousHomeScore());
        verify(events, times(1)).publishEvent(any(MatchSyncIncidentOpenedEvent.class));
    }

    @Test
    @DisplayName("Terminado pero sin marcador también se bloquea")
    void blocksAFinishedMatchWithoutScore() {
        assertTrue(guard.holdsResult(match, null, null, null, MatchStatusNormalized.FINISHED));
        assertEquals(Status.BLOCKED, only(Kind.REGRESSION).getStatus());
    }

    @Test
    @DisplayName("Un marcador final distinto se retiene y se aplica solo cuando el proveedor lo repite pasados 10 minutos")
    void appliesAScoreChangeOnceConfirmed() {
        assertTrue(guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED));
        clock.advance(Duration.ofMinutes(5));
        assertTrue(guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED), "aún no han pasado 10 min");
        clock.advance(Duration.ofMinutes(6));
        assertFalse(guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED));

        MatchSyncIncident incident = only(Kind.SCORE_CHANGE);
        assertEquals(Status.APPLIED, incident.getStatus());
        assertEquals(MatchSyncIncident.BY_AUTO, incident.getResolvedBy());
    }

    @Test
    @DisplayName("Si el marcador recibido cambia otra vez, la espera vuelve a empezar")
    void restartsTheWaitWhenTheReceivedScoreChanges() {
        guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED);
        clock.advance(Duration.ofMinutes(11));
        assertTrue(guard.holdsResult(match, 3, 1, null, MatchStatusNormalized.FINISHED));

        MatchSyncIncident incident = only(Kind.SCORE_CHANGE);
        assertEquals(Status.PENDING, incident.getStatus());
        assertEquals(1, incident.getSeenCount());
        assertEquals(3, incident.getReceivedHomeScore());
    }

    @Test
    @DisplayName("Si el proveedor vuelve al marcador guardado, la incidencia se descarta sola")
    void dismissesWhenTheProviderGoesBackToTheStoredScore() {
        guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED);
        assertFalse(guard.holdsResult(match, 2, 1, null, MatchStatusNormalized.FINISHED));

        MatchSyncIncident incident = only(Kind.SCORE_CHANGE);
        assertEquals(Status.DISMISSED, incident.getStatus());
        assertEquals(MatchSyncIncident.BY_AUTO, incident.getResolvedBy());
    }

    @Test
    @DisplayName("Lo que el administrador descartó se sigue reteniendo sin volver a avisar")
    void keepsHoldingWhatTheAdminDismissedWithoutAlerting() {
        guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED);
        MatchSyncIncident incident = only(Kind.SCORE_CHANGE);
        incident.setStatus(Status.DISMISSED);
        incident.setResolvedBy(MatchSyncIncident.BY_ADMIN);
        clearInvocations(events);

        clock.advance(Duration.ofHours(1));
        assertTrue(guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED));
        assertTrue(guard.holdsResult(match, 2, 2, null, MatchStatusNormalized.FINISHED));

        assertEquals(Status.DISMISSED, only(Kind.SCORE_CHANGE).getStatus());
        verifyNoInteractions(events);
    }

    @Test
    @DisplayName("Una pelea que falta se cancela cuando sigue faltando pasados 30 minutos, sin avisar")
    void confirmsAMissingFightAfterThirtyMinutes() {
        assertFalse(guard.confirmsFightMissing(match));
        clock.advance(Duration.ofMinutes(20));
        assertFalse(guard.confirmsFightMissing(match));
        clock.advance(Duration.ofMinutes(11));
        assertTrue(guard.confirmsFightMissing(match));

        assertEquals(Status.APPLIED, only(Kind.FIGHT_MISSING).getStatus());
        verifyNoInteractions(events);
    }

    @Test
    @DisplayName("Una pelea que vuelve a la cartelera deja de faltar")
    void dismissesAMissingFightThatComesBack() {
        guard.confirmsFightMissing(match);
        guard.fightsBackOnCard(List.of(10L));

        MatchSyncIncident incident = only(Kind.FIGHT_MISSING);
        assertEquals(Status.DISMISSED, incident.getStatus());
        assertEquals(MatchSyncIncident.BY_AUTO, incident.getResolvedBy());
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
