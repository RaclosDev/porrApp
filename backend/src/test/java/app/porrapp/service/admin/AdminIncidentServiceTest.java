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
import app.porrapp.service.sync.SyncLock;
import app.porrapp.service.tournament.KnockoutBracketService;
import app.porrapp.service.tournament.StandingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminIncidentServiceTest {

    private static final Instant NOW = Instant.parse("2026-06-15T21:00:00Z");

    private final MatchSyncIncidentRepository incidents = mock(MatchSyncIncidentRepository.class);
    private final MatchRepository matchRepository = mock(MatchRepository.class);
    private final TeamRepository teamRepository = mock(TeamRepository.class);
    private final MatchPredictionService predictions = mock(MatchPredictionService.class);
    private final FightCardService fightCards = mock(FightCardService.class);
    private final ScoreInvalidationService invalidation = mock(ScoreInvalidationService.class);
    private final WebSocketService webSocket = mock(WebSocketService.class);
    private final SyncLock syncLock = new SyncLock();
    private AdminIncidentService service;

    private final Team home = Team.builder().id(1L).name("Betis").build();
    private final Team away = Team.builder().id(2L).name("Sevilla").build();
    private final Competition competition = Competition.builder().id(5L).name("LaLiga").build();
    private Match match;

    @BeforeEach
    void setUp() {
        service = new AdminIncidentService(incidents, matchRepository, teamRepository, predictions, fightCards,
                invalidation, webSocket, mock(KnockoutBracketService.class), mock(StandingsService.class), syncLock,
                new TransactionTemplate(mock(PlatformTransactionManager.class)), Clock.fixed(NOW, ZoneOffset.UTC));
        match = Match.builder().id(10L).homeTeam(home).awayTeam(away).competition(competition)
                .homeScore(2).awayScore(1).finished(true).status(MatchStatusNormalized.FINISHED).build();
        when(matchRepository.findById(10L)).thenReturn(Optional.of(match));
        when(incidents.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private MatchSyncIncident incident(Kind kind, Status status) {
        MatchSyncIncident incident = new MatchSyncIncident();
        incident.setId(3L);
        incident.setMatchId(10L);
        incident.setKind(kind);
        incident.setStatus(status);
        incident.setPreviousStatus(MatchStatusNormalized.FINISHED);
        incident.setPreviousHomeScore(2);
        incident.setPreviousAwayScore(1);
        incident.setFirstSeenAt(NOW.minusSeconds(60));
        incident.setLastSeenAt(NOW);
        when(incidents.findByIdForUpdate(3L)).thenReturn(Optional.of(incident));
        return incident;
    }

    @Test
    @DisplayName("Aplicar un marcador distinto lo guarda, recalcula las predicciones y avisa a las pantallas")
    void applyingAScoreChangeStoresItAndRecalculates() {
        MatchSyncIncident incident = incident(Kind.SCORE_CHANGE, Status.PENDING);
        incident.setReceivedStatus(MatchStatusNormalized.FINISHED);
        incident.setReceivedHomeScore(2);
        incident.setReceivedAwayScore(2);

        AdminIncidentDTO dto = service.apply(3L);

        assertEquals("APPLIED", dto.status());
        assertEquals(2, match.getAwayScore());
        assertTrue(match.getFinished());
        assertEquals(MatchSyncIncident.BY_ADMIN, incident.getResolvedBy());
        assertEquals(NOW, incident.getResolvedAt());
        verify(predictions).evaluatePredictionsForMatch(match);
        verify(invalidation).invalidateCompetition(5L);
        verify(webSocket).notifyResultsChanged(List.of(5L));
        assertTrue(syncLock.tryLock(), "el cerrojo queda libre");
        syncLock.unlock();
    }

    @Test
    @DisplayName("Aplicar una vuelta atrás deja el partido sin jugar y quita sus puntos")
    void applyingARegressionClearsThePoints() {
        incident(Kind.REGRESSION, Status.BLOCKED);

        service.apply(3L);

        assertFalse(match.getFinished());
        assertEquals(MatchStatusNormalized.SCHEDULED, match.getStatus());
        assertNull(match.getHomeScore());
        verify(predictions).clearMatchPoints(match);
        verify(predictions, never()).evaluatePredictionsForMatch(any());
    }

    @Test
    @DisplayName("Aplicar una pelea que falta la cancela si aún no está terminada")
    void applyingAMissingFightCancelsIt() {
        incident(Kind.FIGHT_MISSING, Status.PENDING);
        match.setFinished(false);
        match.setStatus(MatchStatusNormalized.SCHEDULED);

        service.apply(3L);

        verify(fightCards).cancelFightByAdmin(match);
    }

    @Test
    @DisplayName("Descartar deja el resultado guardado")
    void dismissingKeepsTheStoredResult() {
        MatchSyncIncident incident = incident(Kind.SCORE_CHANGE, Status.PENDING);

        AdminIncidentDTO dto = service.dismiss(3L);

        assertEquals("DISMISSED", dto.status());
        assertEquals(MatchSyncIncident.BY_ADMIN, incident.getResolvedBy());
        assertEquals(1, match.getAwayScore());
        verifyNoInteractions(predictions, fightCards, invalidation);
    }

    @Test
    @DisplayName("Una incidencia ya resuelta no se vuelve a resolver")
    void aResolvedIncidentCannotBeResolvedAgain() {
        incident(Kind.SCORE_CHANGE, Status.APPLIED);

        BusinessException error = assertThrows(BusinessException.class, () -> service.dismiss(3L));
        assertEquals(HttpStatus.CONFLICT, error.getStatus());
        verify(incidents, never()).save(any());
    }

    @Test
    @DisplayName("Si la sincronización no suelta el cerrojo, se pide volver a intentarlo")
    void waitsForTheSyncAndGivesUp() {
        incident(Kind.SCORE_CHANGE, Status.PENDING);

        AdminIncidentService busy = new AdminIncidentService(incidents, matchRepository, teamRepository, predictions,
                fightCards, invalidation, webSocket, mock(KnockoutBracketService.class), mock(StandingsService.class),
                lockThatNeverFrees(), new TransactionTemplate(mock(PlatformTransactionManager.class)),
                Clock.fixed(NOW, ZoneOffset.UTC));

        BusinessException error = assertThrows(BusinessException.class, () -> busy.apply(3L));
        assertEquals(HttpStatus.CONFLICT, error.getStatus());
        verifyNoInteractions(predictions);
    }

    @Test
    @DisplayName("El listado pone los nombres del partido y del ganador y la hora a la que se aplicaría solo")
    void listsWithNamesAndAutoApplyTime() {
        MatchSyncIncident open = incident(Kind.SCORE_CHANGE, Status.PENDING);
        open.setPreviousWinnerTeamId(1L);
        open.setReceivedWinnerTeamId(99L);
        when(incidents.findByStatusInOrderByLastSeenAtDesc(any())).thenReturn(List.of(open));
        when(incidents.findRecentlyResolved(any(), any())).thenReturn(List.of());
        when(matchRepository.findAllById(any())).thenReturn(List.of(match));
        when(teamRepository.findAllById(any())).thenReturn(List.of(Team.builder().id(99L).name("Cádiz").build()));

        AdminIncidentDTO dto = service.list().get(0);

        assertEquals("Betis - Sevilla", dto.match());
        assertEquals("LaLiga", dto.competition());
        assertEquals("Betis", dto.previous().winner());
        assertEquals("Cádiz", dto.received().winner());
        assertEquals(NOW.minusSeconds(60).plus(AdminIncidentService.CONFIRM_SCORE_AFTER), dto.autoApplyAt());
    }

    @Test
    @DisplayName("Una vuelta atrás nunca tiene hora de aplicarse sola")
    void regressionsNeverAutoApply() {
        MatchSyncIncident blocked = incident(Kind.REGRESSION, Status.BLOCKED);
        assertNull(AdminIncidentService.autoApplyAt(blocked));
        MatchSyncIncident fight = incident(Kind.FIGHT_MISSING, Status.PENDING);
        assertEquals(fight.getFirstSeenAt().plus(AdminIncidentService.CONFIRM_FIGHT_MISSING_AFTER),
                AdminIncidentService.autoApplyAt(fight));
    }

    private static SyncLock lockThatNeverFrees() {
        return new SyncLock() {
            @Override
            public boolean tryLock(long timeout, java.util.concurrent.TimeUnit unit) {
                return false;
            }
        };
    }
}
