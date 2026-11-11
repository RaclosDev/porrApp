package app.porrapp.service.notification;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Team;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.MatchReminderSentRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import tools.jackson.databind.ObjectMapper;
import app.porrapp.service.prediction.DrawnKnockout;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Avisos de series de la NBA a punto de cerrar. */
class SeriesReminderServiceTest {
    private static final Instant START = AppTime.fromLocal(LocalDateTime.of(2027, 4, 18, 19, 0));

    private final Competition nba = Competition.builder().id(9L).name("NBA")
            .externalId(Competition.NBA_EXTERNAL_ID).formatType("TOURNAMENT").build();
    private final List<Match> fixtures = new ArrayList<>();
    private long nextId = 1;

    private void series(String home, String away, Instant first) {
        Team homeTeam = Team.builder().id(nextId * 100).name(home).build();
        Team awayTeam = Team.builder().id(nextId * 100 + 1).name(away).build();
        for (int game = 0; game < 4; game++) {
            fixtures.add(Match.builder().id(nextId++).competition(nba).round("r16").homeTeam(homeTeam).awayTeam(awayTeam)
                    .matchDate(first.plus(2L * game, ChronoUnit.DAYS)).finished(false)
                    .status(MatchStatusNormalized.SCHEDULED).build());
        }
    }

    private Edition edition(PredictionLockMode mode, int offset) {
        return Edition.builder().id(1L).competition(nba).poolFormat(PoolFormat.KNOCKOUTS_ONLY).lockMode(mode)
                .lockOffsetMinutes(offset).createdAt(START.minus(30, ChronoUnit.DAYS)).build();
    }

    @Test
    void retainsQueuedDeviceWhenAnotherDeviceAcceptedTheSeriesReminder() {
        series("Cavaliers", "Heat", START);
        var edition = edition(PredictionLockMode.PER_MATCH, 0);
        var tie = DrawnKnockout.rounds(edition, fixtures).get(0).ties().get(0);
        var reminders = mock(MatchReminderSentRepository.class);
        var subscriptions = mock(PushSubscriptionRepository.class);
        var sender = mock(WebPushSender.class);
        var history = mock(PushNotificationLogService.class);
        var service = spy(new SeriesReminderService(null, null, null, null, reminders, subscriptions,
                sender, new ObjectMapper(), history));
        var league = League.builder().id(7L).name("NBA").build();
        var user = UserAccount.builder().id(1L).build();
        doReturn(List.of(new SeriesReminderService.Pending(1L, league, tie, START)))
                .when(service).findPending(START.minusSeconds(600));
        when(subscriptions.findByUserIdIn(any())).thenReturn(List.of(
                PushSubscription.builder().user(user).endpoint("apple").p256dh("key").auth("auth").build(),
                PushSubscription.builder().user(user).endpoint("android").p256dh("key").auth("auth").build()));
        when(sender.send(anyString(), anyString(), anyString(), anyString(), eq(600), eq(1L)))
                .thenReturn(WebPushSender.Result.QUEUED, WebPushSender.Result.SENT);

        assertEquals(1, service.sendReminders(START.minusSeconds(600)));
        verify(sender, times(2)).send(anyString(), anyString(), anyString(), anyString(), eq(600), eq(1L));
        verify(reminders).saveAll(any());
        verify(history).record(eq(1L), any(), eq(START.minusSeconds(600)));
        verify(subscriptions, never()).deleteByEndpoint(anyString());
    }

    @Test
    @DisplayName("Avisa de cada serie que cierra en la próxima hora, con su margen de cierre")
    void dueSeriesWithinTheHour() {
        series("Cavaliers", "Heat", START);
        series("Celtics", "Magic", START.plus(1, ChronoUnit.DAYS));
        Edition edition = edition(PredictionLockMode.PER_MATCH, 30);
        List<DrawnKnockout.Round> rounds = DrawnKnockout.rounds(edition, fixtures);

        var due = SeriesReminderService.dueSeries(edition, rounds, START.minus(80, ChronoUnit.MINUTES),
                START.minus(20, ChronoUnit.MINUTES));

        assertEquals(1, due.size());
        assertEquals("Cavaliers", due.get(0).tie().home().getName());
        assertEquals(START.minus(30, ChronoUnit.MINUTES), due.get(0).lockAt());
        // Ya cerrada: no se avisa.
        assertTrue(SeriesReminderService.dueSeries(edition, rounds, START.minus(10, ChronoUnit.MINUTES),
                START.plus(50, ChronoUnit.MINUTES)).isEmpty());
    }

    @Test
    @DisplayName("Con cierre por rondas, todas las series de la ronda cierran con la primera")
    void perRoundLocksAllSeriesTogether() {
        series("Cavaliers", "Heat", START);
        series("Celtics", "Magic", START.plus(1, ChronoUnit.DAYS));
        Edition edition = edition(PredictionLockMode.PER_ROUND, 0);

        var due = SeriesReminderService.dueSeries(edition, DrawnKnockout.rounds(edition, fixtures),
                START.minus(1, ChronoUnit.HOURS), START);

        assertEquals(2, due.size());
    }

    @Test
    @DisplayName("El aviso nombra la serie o cuenta las pendientes y lleva a la predicción de la liga")
    void message() {
        series("Cavaliers", "Heat", START);
        series("Celtics", "Magic", START);
        Edition edition = edition(PredictionLockMode.PER_MATCH, 0);
        var ties = DrawnKnockout.rounds(edition, fixtures).get(0).ties();
        League league = League.builder().id(7L).name("Los del parque").build();
        SeriesReminderService service = new SeriesReminderService(null, null, null, null, null, null,
                mock(WebPushSender.class), null, null);

        PushMessage one = service.message(List.of(new SeriesReminderService.Pending(1L, league, ties.get(0), START)), START);
        PushMessage two = service.message(List.of(new SeriesReminderService.Pending(1L, league, ties.get(0), START),
                new SeriesReminderService.Pending(1L, league, ties.get(1), START)), START);

        assertEquals("Te falta predecir Cavaliers – Heat", one.title());
        assertEquals("/prediction?group=7", one.url());
        assertEquals("Te faltan 2 series por predecir", two.title());
        assertTrue(two.body().startsWith("Los del parque"));
    }
}
