package com.porra.mundial.service;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchReminderSent;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchReminderSentRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MatchReminderServiceTest {

    private static final Instant NOW = AppTime.fromLocal(LocalDateTime.of(2026, 11, 7, 17, 0));

    private final EditionRepository editions = mock(EditionRepository.class);
    private final MatchRepository matches = mock(MatchRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final MatchPredictionRepository predictions = mock(MatchPredictionRepository.class);
    private final MatchReminderSentRepository reminders = mock(MatchReminderSentRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final ObjectMapper json = JsonMapper.builder().build();
    private final MatchReminderService service = new MatchReminderService(editions, matches, memberships,
            predictions, reminders, subscriptions, sender, json);

    private final League league = League.builder().id(5L).name("Los del barrio").joinCode("BARRIO").build();
    private final Competition competition = Competition.builder().id(9L).build();
    private final UserAccount ana = user(1L, true);
    private final UserAccount luis = user(2L, true);
    private final UserAccount muted = user(3L, false);
    private Edition edition;

    @BeforeEach
    void setUp() {
        edition = Edition.builder().id(50L).league(league).competition(competition)
                .poolFormat(PoolFormat.MATCH_DAY).lockMode(PredictionLockMode.PER_MATCH).build();
        when(editions.findActiveByPoolFormat(PoolFormat.MATCH_DAY)).thenReturn(List.of(edition));
        when(memberships.findByLeagueId(5L)).thenReturn(List.of(member(ana), member(luis), member(muted)));
        when(reminders.findKeysByMatchIdIn(any())).thenReturn(List.of());
        when(predictions.findPredictedUserMatchPairs(eq(50L), any())).thenReturn(List.of());
    }

    @Test
    void remindsOnlyMembersWithoutPredictionWhoseMatchClosesWithinTheHour() {
        Match soon = match(100L, NOW.plus(45, ChronoUnit.MINUTES));
        Match later = match(101L, NOW.plus(90, ChronoUnit.MINUTES));
        when(matches.findUnfinishedStartingBetween(eq(9L), eq(NOW), any())).thenReturn(List.of(soon, later));
        when(predictions.findPredictedUserMatchPairs(eq(50L), any()))
                .thenReturn(List.<Object[]>of(new Object[]{2L, 100L}));

        List<MatchReminderService.Pending> pending = service.findPending(NOW);

        assertThat(pending).extracting(MatchReminderService.Pending::userId).containsExactly(1L);
        assertThat(pending).extracting(p -> p.match().getId()).containsExactly(100L);
    }

    @Test
    void appliesTheLeagueLockOffsetBeforeTheKickoff() {
        edition.setLockOffsetMinutes(30);
        // Empieza en 80 min pero cierra en 50: entra.
        when(matches.findUnfinishedStartingBetween(eq(9L), eq(NOW), eq(NOW.plus(90, ChronoUnit.MINUTES))))
                .thenReturn(List.of(match(100L, NOW.plus(80, ChronoUnit.MINUTES))));

        assertThat(service.findPending(NOW)).extracting(p -> p.lockAt()).containsOnly(NOW.plus(50, ChronoUnit.MINUTES));
    }

    @Test
    void perRoundLeaguesRemindAboutLaterMatchesThatCloseWithTheFirst() {
        edition.setLockMode(PredictionLockMode.PER_ROUND);
        Match first = match(100L, NOW.plus(40, ChronoUnit.MINUTES));
        Match sunday = match(101L, NOW.plus(2, ChronoUnit.DAYS));
        first.setRound("Jornada 12");
        sunday.setRound("Jornada 12");
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(first, sunday));

        assertThat(service.findPending(NOW)).filteredOn(p -> p.userId().equals(1L))
                .extracting(p -> p.match().getId()).containsExactlyInAnyOrder(100L, 101L);
    }

    @Test
    void skipsMatchesAlreadyRemindedAndLeaguesThatAreLocked() {
        when(matches.findUnfinishedStartingBetween(eq(9L), eq(NOW), any()))
                .thenReturn(List.of(match(100L, NOW.plus(30, ChronoUnit.MINUTES))));
        when(reminders.findKeysByMatchIdIn(any())).thenReturn(List.of(new MatchReminderSent.Key(1L, 100L)));

        assertThat(service.findPending(NOW)).extracting(MatchReminderService.Pending::userId).containsExactly(2L);

        edition.setStatus("ARCHIVED");
        assertThat(service.findPending(NOW)).isEmpty();
    }

    @Test
    void sendsOneGroupedNotificationAndRecordsItOnlyWhenDelivered() {
        when(matches.findUnfinishedStartingBetween(eq(9L), eq(NOW), any()))
                .thenReturn(List.of(match(100L, NOW.plus(30, ChronoUnit.MINUTES)), match(101L, NOW.plus(50, ChronoUnit.MINUTES))));
        PushSubscription phone = device(ana, "https://fcm.googleapis.com/fcm/send/ana");
        PushSubscription oldPhone = device(ana, "https://fcm.googleapis.com/fcm/send/old");
        PushSubscription luisPhone = device(luis, "https://web.push.apple.com/luis");
        when(subscriptions.findByUserIdIn(any())).thenReturn(List.of(phone, oldPhone, luisPhone));
        when(sender.send(eq(phone.getEndpoint()), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.SENT);
        when(sender.send(eq(oldPhone.getEndpoint()), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.GONE);
        when(sender.send(eq(luisPhone.getEndpoint()), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.FAILED);

        assertThat(service.sendReminders(NOW)).isEqualTo(1);

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(sender).send(eq(phone.getEndpoint()), anyString(), anyString(), payload.capture(), eq(1800));
        Map<?, ?> message = json.readValue(payload.getValue(), Map.class);
        assertThat(message.get("title")).isEqualTo("Te faltan 2 predicciones");
        assertThat(message.get("body")).isEqualTo("Los del barrio · la primera cierra a las 17:30");
        assertThat(message.get("url")).isEqualTo("/jornadas?group=5");
        verify(subscriptions).deleteByEndpoint(oldPhone.getEndpoint());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<MatchReminderSent>> saved = ArgumentCaptor.forClass(Collection.class);
        verify(reminders).saveAll(saved.capture());
        assertThat(new ArrayList<>(saved.getValue())).extracting(r -> r.getId().getUserId()).containsOnly(1L);
        assertThat(saved.getValue()).hasSize(2);
    }

    @Test
    void namesTheMatchWhenOnlyOneIsPending() {
        Match match = match(100L, NOW.plus(60, ChronoUnit.MINUTES));
        List<MatchReminderService.Pending> pending =
                List.of(new MatchReminderService.Pending(1L, league, match, NOW.plus(60, ChronoUnit.MINUTES)));

        Map<?, ?> message = json.readValue(service.payload(pending, NOW.plus(60, ChronoUnit.MINUTES)), Map.class);

        assertThat(message.get("title")).isEqualTo("Te falta predecir Betis – Sevilla");
        assertThat(message.get("body")).isEqualTo("Los del barrio · cierra a las 18:00");
    }

    @Test
    void doesNothingWithoutVapidKeys() {
        when(sender.isEnabled()).thenReturn(false);

        service.sendDueReminders();

        verify(editions, never()).findActiveByPoolFormat(any());
    }

    private static UserAccount user(Long id, boolean reminders) {
        return UserAccount.builder().id(id).googleEmail(id + "@test").participantName("u" + id)
                .matchRemindersEnabled(reminders).build();
    }

    private Membership member(UserAccount user) {
        return Membership.builder().id(new Membership.MembershipId(user.getId(), 5L)).user(user).league(league).build();
    }

    private static Match match(Long id, Instant kickoff) {
        return Match.builder().id(id).matchDate(kickoff)
                .homeTeam(Team.builder().id(id * 10).name("Betis").build())
                .awayTeam(Team.builder().id(id * 10 + 1).name("Sevilla").build())
                .build();
    }

    private static PushSubscription device(UserAccount user, String endpoint) {
        return PushSubscription.builder().user(user).endpoint(endpoint).p256dh("k").auth("a").build();
    }
}
