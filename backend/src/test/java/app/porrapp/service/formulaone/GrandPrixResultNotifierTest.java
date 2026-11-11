package app.porrapp.service.formulaone;

import app.porrapp.model.*;
import app.porrapp.repository.*;
import app.porrapp.service.notification.PushNotificationLogService;
import app.porrapp.service.notification.WebPushSender;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GrandPrixResultNotifierTest {
    private final EditionRepository editions = mock(EditionRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final MatchPredictionRepository predictions = mock(MatchPredictionRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final RaceDriverRepository drivers = mock(RaceDriverRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final PushNotificationLogService history = mock(PushNotificationLogService.class);
    private final GrandPrixResultNotifier notifier = new GrandPrixResultNotifier(editions, memberships,
            predictions, subscriptions, drivers, sender, history, new ObjectMapper());
    private final Match race = Match.builder().id(8L).round("GP de España")
            .competition(Competition.builder().id(9L).build()).build();

    private void recipients(UserAccount... users) {
        var league = League.builder().id(6L).name("Paddock").build();
        when(editions.findActiveByPoolFormat(PoolFormat.GRAND_PRIX)).thenReturn(List.of(
                Edition.builder().competition(race.getCompetition()).league(league).build()));
        when(memberships.findByLeagueId(6L)).thenReturn(java.util.Arrays.stream(users)
                .map(user -> Membership.builder().user(user).league(league).build()).toList());
    }

    @Test
    void usesResultPreferencesIndependentlyOfPredictionReminders() {
        var enabled = UserAccount.builder().id(1L).matchRemindersEnabled(false)
                .matchdayFinishedAlertsEnabled(true).build();
        var disabled = UserAccount.builder().id(2L).matchRemindersEnabled(true)
                .matchdayFinishedAlertsEnabled(false).build();
        recipients(enabled, disabled);
        assertEquals(java.util.Set.of(1L), notifier.recipients(race).keySet());
    }

    @Test
    void queuedResultsDoNotClaimDeliveryAndUnretainedFailuresAreRetriedBySync() {
        var user = UserAccount.builder().id(1L).matchdayFinishedAlertsEnabled(true).build();
        recipients(user);
        when(sender.isEnabled()).thenReturn(true);
        when(subscriptions.findByUserIdIn(any())).thenReturn(List.of(PushSubscription.builder()
                .user(user).endpoint("apple").p256dh("key").auth("auth").build()));
        var weekend = RaceWeekend.builder().firstDriverId(1L).secondDriverId(2L).thirdDriverId(3L).build();
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt(), eq(1L)))
                .thenReturn(WebPushSender.Result.QUEUED, WebPushSender.Result.FAILED);

        assertEquals(0, notifier.notifyResult(race, weekend));
        verifyNoInteractions(history);
        assertThrows(IllegalStateException.class, () -> notifier.notifyResult(race, weekend));
    }
}
