package app.porrapp.service.notification;

import app.porrapp.repository.PushDeliveryRetryRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class PushRetryQueue {
    private final PushDeliveryRetryRepository retries;
    private final PushSubscriptionRepository subscriptions;

    // El reintento sobrevive aunque la operación que originó el aviso termine después con un error.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean enqueue(String endpoint, Long userId, String payload, Instant startedAt, int ttlSeconds) {
        var subscription = subscriptions.findByEndpoint(endpoint).orElse(null);
        if (subscription == null || !subscription.getUser().getId().equals(userId)
                || !startedAt.plusSeconds(ttlSeconds).isAfter(Instant.now())) return false;
        retries.enqueue(subscription.getId(), subscription.getUser().getId(), payload, hash(payload),
                startedAt, startedAt.plusSeconds(ttlSeconds), Instant.now().plusSeconds(60));
        return true;
    }

    private static String hash(String payload) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
