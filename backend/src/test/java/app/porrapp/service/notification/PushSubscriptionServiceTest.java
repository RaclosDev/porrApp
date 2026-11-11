package app.porrapp.service.notification;

import app.porrapp.dto.PushSubscriptionRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PushSubscriptionServiceTest {

    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
    private static final String P256DH = "BOrK7iT5c2gQ0lC0e3n8uQ";
    private static final String AUTH = "c2VjcmV0LWF1dGg";

    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final PushSubscriptionService service =
            new PushSubscriptionService(subscriptions, users, sender);

    private UserAccount ana;
    private UserAccount bea;

    @BeforeEach
    void setUp() {
        ana = UserAccount.builder().id(1L).googleEmail("ana@test.com").build();
        bea = UserAccount.builder().id(2L).googleEmail("bea@test.com").build();
        when(users.findByGoogleEmail("ana@test.com")).thenReturn(Optional.of(ana));
        when(users.findByGoogleEmail("bea@test.com")).thenReturn(Optional.of(bea));
    }

    private static PushSubscription stored(UserAccount owner, String p256dh, String auth) {
        return PushSubscription.builder().id(9L).user(owner).endpoint(ENDPOINT).p256dh(p256dh).auth(auth).build();
    }

    @Test
    void testNotificationCannotTargetAnotherAccountsDevice() {
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(stored(bea, P256DH, AUTH)));
        assertThatThrownBy(() -> service.testNotification("ana@test.com", ENDPOINT)).isInstanceOf(BusinessException.class);
        org.mockito.Mockito.verifyNoInteractions(sender);
    }

    @Test
    void testNotificationReportsProviderAcceptanceWithoutChangingPreferences() {
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(stored(ana, P256DH, AUTH)));
        when(sender.send(org.mockito.ArgumentMatchers.eq(ENDPOINT), org.mockito.ArgumentMatchers.eq(P256DH),
                org.mockito.ArgumentMatchers.eq(AUTH), org.mockito.ArgumentMatchers.contains("Prueba de notificaciones"),
                org.mockito.ArgumentMatchers.eq(60), org.mockito.ArgumentMatchers.eq(ana.getId()))).thenReturn(WebPushSender.Result.SENT);
        service.testNotification("ana@test.com", ENDPOINT);
        verify(users, never()).save(any());
        verify(subscriptions, never()).deleteByEndpointAndUserId(any(), any());
    }

    @Test
    void testNotificationRemovesOnlyAnExpiredDeviceAndReportsFailure() {
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(stored(ana, P256DH, AUTH)));
        when(sender.send(any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyInt(), any())).thenReturn(WebPushSender.Result.GONE);
        assertThatThrownBy(() -> service.testNotification("ana@test.com", ENDPOINT))
                .isInstanceOf(BusinessException.class).hasMessageContaining("caducado");
        verify(subscriptions).deleteByEndpointAndUserId(ENDPOINT, ana.getId());
    }

    @Test
    void failedTestNeverClaimsAcceptance() {
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(stored(ana, P256DH, AUTH)));
        when(sender.send(any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyInt(), any())).thenReturn(WebPushSender.Result.FAILED);
        assertThatThrownBy(() -> service.testNotification("ana@test.com", ENDPOINT))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no ha aceptado");
        verify(subscriptions, never()).deleteByEndpointAndUserId(any(), any());
    }

    @Test
    void theSameBrowserMovesToTheAccountThatSignsIn() {
        PushSubscription subscription = stored(ana, P256DH, AUTH);
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(subscription));

        service.subscribe("bea@test.com", new PushSubscriptionRequest(ENDPOINT, P256DH, AUTH));

        assertThat(subscription.getUser()).isSameAs(bea);
        verify(subscriptions).save(subscription);
    }

    @Test
    void anotherAccountCannotTakeAnEndpointWithDifferentKeys() {
        PushSubscription subscription = stored(ana, P256DH, AUTH);
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(subscription));

        assertThatThrownBy(() -> service.subscribe("bea@test.com",
                new PushSubscriptionRequest(ENDPOINT, "QkVBLWtleQ", "QkVBLWF1dGg")))
                .isInstanceOf(BusinessException.class);

        assertThat(subscription.getUser()).isSameAs(ana);
        verify(subscriptions, never()).save(any());
    }

    @Test
    void theOwnerCanRenewItsKeys() {
        PushSubscription subscription = stored(ana, P256DH, AUTH);
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(subscription));

        service.subscribe("ana@test.com", new PushSubscriptionRequest(ENDPOINT, "TlVFVkEta2V5", AUTH));

        assertThat(subscription.getP256dh()).isEqualTo("TlVFVkEta2V5");
        verify(subscriptions).save(subscription);
    }

    @Test
    @SuppressWarnings("unchecked")
    void aNewDeviceBeyondTheLimitDropsTheOldestOnes() {
        List<PushSubscription> current = new ArrayList<>(IntStream.range(0, PushSubscriptionService.MAX_SUBSCRIPTIONS_PER_USER)
                .mapToObj(i -> PushSubscription.builder().id((long) i).user(ana).build())
                .toList());
        when(subscriptions.findByEndpoint(ENDPOINT)).thenReturn(Optional.empty());
        when(subscriptions.findByUserIdOrderByCreatedAtAsc(1L)).thenReturn(current);

        service.subscribe("ana@test.com", new PushSubscriptionRequest(ENDPOINT, P256DH, AUTH));

        ArgumentCaptor<Iterable<PushSubscription>> dropped = ArgumentCaptor.forClass(Iterable.class);
        verify(subscriptions).deleteAll(dropped.capture());
        assertThat(dropped.getValue()).containsExactly(current.get(0));
        verify(subscriptions).save(any(PushSubscription.class));
    }
}
