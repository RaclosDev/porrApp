package app.porrapp.service.notification;

import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PushDeliveryRetryRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(PushRetryQueue.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PushRetryQueuePersistenceTest {
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");
    @Autowired private PushRetryQueue queue;
    @Autowired private PushDeliveryRetryRepository retries;
    @Autowired private PushSubscriptionRepository subscriptions;
    @Autowired private UserAccountRepository users;
    @Autowired private org.springframework.transaction.PlatformTransactionManager transactions;

    @Test
    void persistsIdempotentlyAndCascadesWhenTheDeviceIsRemoved() {
        UserAccount user = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("P").build());
        PushSubscription device = subscriptions.save(PushSubscription.builder().user(user)
                .endpoint("https://web.push.apple.com/" + UUID.randomUUID()).p256dh("key").auth("auth").build());
        Instant now = Instant.now();
        String payload = "{\"title\":\"Test\"}";
        assertThat(queue.enqueue(device.getEndpoint(), user.getId(), payload, now, 300)).isTrue();
        assertThat(queue.enqueue(device.getEndpoint(), user.getId(), payload, now, 300)).isTrue();
        assertThat(retries.findAll()).singleElement().satisfies(item -> {
            assertThat(item.getUserId()).isEqualTo(user.getId());
            assertThat(item.getPayload()).isEqualTo(payload);
            assertThat(item.getPayloadHash()).hasSize(64);
        });
        subscriptions.deleteById(device.getId());
        assertThat(retries.findAll()).isEmpty();
        users.deleteById(user.getId());
    }

    @Test
    void rejectsExpiredMessagesAndOwnershipChanges() {
        UserAccount user = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("P").build());
        PushSubscription device = subscriptions.save(PushSubscription.builder().user(user)
                .endpoint("https://fcm.googleapis.com/" + UUID.randomUUID()).p256dh("key").auth("auth").build());
        assertThat(queue.enqueue(device.getEndpoint(), user.getId() + 1, "{}", Instant.now(), 300)).isFalse();
        assertThat(queue.enqueue(device.getEndpoint(), user.getId(), "{}", Instant.now().minusSeconds(400), 300)).isFalse();
        assertThat(retries.findAll()).isEmpty();
        subscriptions.deleteById(device.getId());
        users.deleteById(user.getId());
    }

    @Test
    void receiptCanArriveBeforeProviderResponseAndEnablesFutureConfirmationRetries() {
        UserAccount user = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("P").build());
        PushSubscription device = subscriptions.save(PushSubscription.builder().user(user)
                .endpoint("https://web.push.apple.com/" + UUID.randomUUID()).p256dh("key").auth("auth").build());
        var first = queue.prepare(device.getEndpoint(), user.getId(), "{\"title\":\"Rober\"}", Instant.now(), 300);
        assertThat(first.isReceiptExpected()).isFalse();
        assertThat(first.getAttempts()).isEqualTo(1);
        assertThat(PushRetryQueue.wirePayload(first)).contains(first.getReceiptToken().toString());
        queue.acknowledge(first.getReceiptToken());
        Instant received = retries.findById(first.getId()).orElseThrow().getReceivedAt();
        assertThat(received).isNotNull();
        queue.sent(first.getId(), WebPushSender.Result.SENT);
        queue.acknowledge(first.getReceiptToken());
        var saved = retries.findById(first.getId()).orElseThrow();
        assertThat(saved.getReceivedAt()).isEqualTo(received);
        assertThat(saved.getAcceptedAt()).isNotNull();
        assertThat(saved.getFinishedAt()).isNotNull();
        assertThat(subscriptions.findById(device.getId()).orElseThrow().isReceiptsEnabled()).isTrue();
        assertThat(retries.findTop20ByFinishedAtIsNullAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(Instant.now().plusSeconds(400))).isEmpty();

        var next = queue.prepare(device.getEndpoint(), user.getId(), "{\"title\":\"Rober\"}", Instant.now(), 300);
        assertThat(next.isReceiptExpected()).isTrue();
        assertThat(next.getReceiptToken()).isNotEqualTo(first.getReceiptToken());
        queue.sent(next.getId(), WebPushSender.Result.SENT);
        assertThat(retries.findById(next.getId()).orElseThrow().getFinishedAt()).isNull();
        subscriptions.deleteById(device.getId());
        users.deleteById(user.getId());
    }

    @Test
    void unguessableReceiptDoesNotAuthorizeAnotherDeliveryOrAFutureDeviceOwner() {
        UserAccount user = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("P").build());
        UserAccount other = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("Q").build());
        PushSubscription device = subscriptions.save(PushSubscription.builder().user(user)
                .endpoint("https://web.push.apple.com/" + UUID.randomUUID()).p256dh("key").auth("auth").build());
        var pending = queue.prepare(device.getEndpoint(), user.getId(), "{}", Instant.now(), 300);
        queue.acknowledge(UUID.randomUUID());
        queue.acknowledge(null);
        assertThat(retries.findById(pending.getId()).orElseThrow().getReceivedAt()).isNull();
        device.setUser(other);
        subscriptions.save(device);
        queue.acknowledge(pending.getReceiptToken());
        assertThat(retries.findById(pending.getId()).orElseThrow().getReceivedAt()).isNull();
        assertThat(subscriptions.findById(device.getId()).orElseThrow().isReceiptsEnabled()).isFalse();
        subscriptions.deleteById(device.getId());
        users.deleteById(user.getId());
        users.deleteById(other.getId());
    }

    @Test
    void preservesLegacyDeliveryForPayloadsWithoutRoomAndExpiresReceiptCredentials() {
        UserAccount user = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("P").build());
        PushSubscription device = subscriptions.save(PushSubscription.builder().user(user)
                .endpoint("https://web.push.apple.com/" + UUID.randomUUID()).p256dh("key").auth("auth").build());
        assertThat(queue.prepare(device.getEndpoint(), user.getId(), "{\"body\":\"" + "x".repeat(3900) + "\"}", Instant.now(), 300)).isNull();
        assertThat(queue.prepare(device.getEndpoint(), user.getId() + 1000, "{}", Instant.now(), 300)).isNull();
        assertThat(queue.prepare(device.getEndpoint(), user.getId(), "{}", Instant.now(), 0)).isNull();
        var old = queue.prepare(device.getEndpoint(), user.getId(), "{}", Instant.now().minusSeconds(9 * 86400), 300);
        queue.acknowledge(old.getReceiptToken());
        assertThat(retries.findById(old.getId()).orElseThrow().getReceivedAt()).isNull();
        queue.sent(old.getId(), WebPushSender.Result.GONE);
        assertThat(retries.findById(old.getId())).isEmpty();
        subscriptions.deleteById(device.getId());
        users.deleteById(user.getId());
    }

    @Test
    void concurrentRetryCannotOverwriteAReceiptAndOldDiagnosticsArePurged() {
        UserAccount user = users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid").participantName("P").build());
        PushSubscription device = subscriptions.save(PushSubscription.builder().user(user).receiptsEnabled(true)
                .endpoint("https://web.push.apple.com/" + UUID.randomUUID()).p256dh("key").auth("auth").build());
        var pending = queue.prepare(device.getEndpoint(), user.getId(), "{}", Instant.now(), 300);
        var outer = new org.springframework.transaction.support.TransactionTemplate(transactions);
        var inner = new org.springframework.transaction.support.TransactionTemplate(transactions);
        inner.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        outer.executeWithoutResult(status -> {
            var stale = retries.findById(pending.getId()).orElseThrow();
            inner.executeWithoutResult(nested -> queue.acknowledge(pending.getReceiptToken()));
            stale.setAttempts(2);
            stale.setNextAttemptAt(Instant.now().plusSeconds(240));
            retries.saveAndFlush(stale);
        });
        var confirmed = retries.findById(pending.getId()).orElseThrow();
        assertThat(confirmed.getReceivedAt()).isNotNull();
        assertThat(confirmed.getFinishedAt()).isNotNull();
        assertThat(confirmed.getAttempts()).isEqualTo(2);
        var old = queue.prepare(device.getEndpoint(), user.getId(), "{}", Instant.now().minusSeconds(9 * 86400), 300);
        outer.executeWithoutResult(status -> retries.deleteExpiredBefore(Instant.now().minusSeconds(7 * 86400)));
        assertThat(retries.findById(old.getId())).isEmpty();
        assertThat(retries.findById(pending.getId())).isPresent();
        subscriptions.deleteById(device.getId());
        users.deleteById(user.getId());
    }
}
