package app.porrapp.service.notification;

import app.porrapp.model.*;
import app.porrapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PushRetryWorkerTest {
    private final PushDeliveryRetryRepository retries = mock(PushDeliveryRetryRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final PushNotificationLogRepository logs = mock(PushNotificationLogRepository.class);
    private final PushNotificationLogService notificationLog = mock(PushNotificationLogService.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final PushRetryWorker worker = new PushRetryWorker(retries, subscriptions, memberships, logs,
            notificationLog, sender, mapper, mock(PlatformTransactionManager.class));
    private final Instant now = Instant.parse("2026-11-11T12:00:00Z");
    private final UserAccount user = UserAccount.builder().id(7L).matchRemindersEnabled(true)
            .memberJoinedAlertsEnabled(true).matchdayFinishedAlertsEnabled(true).build();
    private final PushSubscription device = PushSubscription.builder().id(1L).user(user)
            .endpoint("https://web.push.apple.com/test").p256dh("key").auth("auth").build();
    private final PushDeliveryRetry pending = new PushDeliveryRetry();
    private final PushMessage message = new PushMessage("Nuevo miembro", "Rober se ha unido", "/?group=6", "member-joined-6");

    @BeforeEach
    void setUp() {
        pending.setId(1L);
        pending.setUserId(7L);
        pending.setSubscriptionId(1L);
        pending.setCreatedAt(now.minusSeconds(60));
        pending.setExpiresAt(now.plusSeconds(300));
        pending.setPayload(message.toJson(mapper));
        when(retries.findById(1L)).thenReturn(Optional.of(pending));
        when(subscriptions.findById(1L)).thenReturn(Optional.of(device));
        when(memberships.existsById(new Membership.MembershipId(7L, 6L))).thenReturn(true);
    }

    @Test
    void retriesTheFailedDeviceAndOnlyLogsProviderAcceptance() {
        when(sender.send(device.getEndpoint(), "key", "auth", pending.getPayload(), 300)).thenReturn(WebPushSender.Result.SENT);
        worker.retry(1L, now);
        verify(notificationLog).record(7L, message, now);
        verify(retries).delete(pending);
        verify(subscriptions, never()).deleteByEndpointAndUserId(anyString(), anyLong());
    }

    @Test
    void keepsFailuresWithBackoffAndTheOriginalExpiry() {
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt())).thenReturn(WebPushSender.Result.FAILED);
        worker.retry(1L, now);
        assertThat(pending.getAttempts()).isEqualTo(1);
        assertThat(pending.getNextAttemptAt()).isEqualTo(now.plusSeconds(120));
        assertThat(pending.getExpiresAt()).isEqualTo(now.plusSeconds(300));
        verify(retries).save(pending);
        verifyNoInteractions(notificationLog);
    }

    @Test
    void removesGoneDevicesWithoutRetryingForever() {
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt())).thenReturn(WebPushSender.Result.GONE);
        worker.retry(1L, now);
        verify(subscriptions).deleteByEndpointAndUserId(device.getEndpoint(), 7L);
        verify(retries).delete(pending);
        verifyNoInteractions(notificationLog);
    }

    @Test
    void neverDeliversToTheNewOwnerOfASharedBrowser() {
        device.setUser(UserAccount.builder().id(8L).build());
        worker.retry(1L, now);
        verify(retries).delete(pending);
        verifyNoInteractions(sender);
    }

    @Test
    void dropsExpiredNotificationsAndNotificationsAfterLeavingALeague() {
        worker.retry(1L, now.plusSeconds(301));
        when(memberships.existsById(any())).thenReturn(false);
        worker.retry(1L, now);
        verify(retries, times(2)).delete(pending);
        verifyNoInteractions(sender);
    }

    @ParameterizedTest
    @ValueSource(strings = {"member-joined-6", "league-repeated-6", "score-day-6", "matchday-finished-6",
            "gp-result-1", "prediction-reminder", "survivor-reminder", "fight-card-6"})
    void respectsUpdatedPreferencesForEveryFlow(String tag) {
        user.setMatchRemindersEnabled(false);
        user.setMemberJoinedAlertsEnabled(false);
        user.setMatchdayFinishedAlertsEnabled(false);
        pending.setPayload(new PushMessage("t", "b", "/?group=6", tag).toJson(mapper));
        worker.retry(1L, now);
        verify(retries).delete(pending);
        verifyNoInteractions(sender);
    }

    @Test
    void f1ResultsUseResultsPreferencesIndependentlyOfPredictionReminders() {
        user.setMatchRemindersEnabled(false);
        assertThat(worker.stillWants(user, new PushMessage("t", "b", "/?group=6", "gp-result-1"))).isTrue();
        user.setMatchdayFinishedAlertsEnabled(false);
        user.setMatchRemindersEnabled(true);
        assertThat(worker.stillWants(user, new PushMessage("t", "b", "/?group=6", "gp-result-1"))).isFalse();
    }

    @Test
    void doesNotDuplicateTheHistoryForAnotherDeviceOfTheSameUser() {
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt())).thenReturn(WebPushSender.Result.SENT);
        when(logs.existsByUserIdAndTitleAndBodyAndUrlAndSentAtGreaterThanEqual(anyLong(), anyString(), anyString(), anyString(), any()))
                .thenReturn(true);
        worker.retry(1L, now);
        verifyNoInteractions(notificationLog);
        verify(retries).delete(pending);
    }

    @Test
    void aBrokenItemDoesNotPreventTheRestOfTheBatch() {
        when(sender.isEnabled()).thenReturn(true);
        var second = new PushDeliveryRetry();
        second.setId(2L);
        when(retries.findTop20ByFinishedAtIsNullAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(any())).thenReturn(List.of(pending, second));
        when(retries.findById(1L)).thenThrow(new IllegalStateException("failure"));
        worker.retryPending();
        verify(retries).findById(2L);
    }

    @Test
    void acceptedButUnconfirmedDeliveryKeepsTheSameTokenAndStopsAfterThreeAttempts() {
        pending.setReceiptToken(java.util.UUID.randomUUID());
        pending.setReceiptExpected(true);
        pending.setAttempts(1);
        pending.setAcceptedAt(now.minusSeconds(60));
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt())).thenReturn(WebPushSender.Result.SENT);
        worker.retry(1L, now);
        assertThat(pending.getAttempts()).isEqualTo(2);
        assertThat(pending.getFinishedAt()).isNull();
        verify(sender).send(eq(device.getEndpoint()), eq("key"), eq("auth"),
                contains(pending.getReceiptToken().toString()), eq(300));
        worker.retry(1L, now.plusSeconds(240));
        assertThat(pending.getAttempts()).isEqualTo(3);
        assertThat(pending.getFinishedAt()).isNotNull();
        worker.retry(1L, now.plusSeconds(250));
        verify(sender, times(2)).send(anyString(), anyString(), anyString(), anyString(), anyInt());
        verify(retries, never()).delete(any());
    }

    @Test
    void confirmedNotificationsNeverResendEvenIfAlreadySelectedByTheScheduler() {
        pending.setReceivedAt(now);
        worker.retry(1L, now);
        verifyNoInteractions(sender);
    }

    @Test
    void olderWorkersStopAtProviderAcceptanceAndTrackedFailuresAreBounded() {
        pending.setReceiptToken(java.util.UUID.randomUUID());
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt())).thenReturn(WebPushSender.Result.SENT);
        worker.retry(1L, now);
        assertThat(pending.getAcceptedAt()).isEqualTo(now);
        assertThat(pending.getFinishedAt()).isEqualTo(now);
        pending.setFinishedAt(null);
        pending.setAttempts(3);
        clearInvocations(sender);
        worker.retry(1L, now);
        verifyNoInteractions(sender);
    }

    @Test
    void expiredTrackedDeliveryIsKeptForDiagnosisAndNeverResent() {
        pending.setReceiptToken(java.util.UUID.randomUUID());
        worker.retry(1L, now.plusSeconds(301));
        assertThat(pending.getFinishedAt()).isNotNull();
        verify(retries, never()).delete(any());
        verifyNoInteractions(sender);
    }
}
