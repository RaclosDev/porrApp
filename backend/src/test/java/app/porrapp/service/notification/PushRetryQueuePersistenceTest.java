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
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Autowired private PushRetryQueue queue;
    @Autowired private PushDeliveryRetryRepository retries;
    @Autowired private PushSubscriptionRepository subscriptions;
    @Autowired private UserAccountRepository users;

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
}
