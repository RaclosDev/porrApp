package app.porrapp.repository;

import app.porrapp.model.PushDeliveryRetry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface PushDeliveryRetryRepository extends JpaRepository<PushDeliveryRetry, Long> {
    List<PushDeliveryRetry> findTop20ByFinishedAtIsNullAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(Instant now);

    java.util.Optional<PushDeliveryRetry> findByReceiptToken(java.util.UUID token);

    @Modifying
    @Query("delete from PushDeliveryRetry p where p.expiresAt < :before")
    int deleteExpiredBefore(Instant before);

    @Modifying
    @Query(value = """
            INSERT INTO push_delivery_retries
                (subscription_id, user_id, payload, payload_hash, created_at, expires_at, next_attempt_at)
            VALUES (:subscriptionId, :userId, :payload, :hash, :now, :expires, :next)
            ON CONFLICT (subscription_id, user_id, payload_hash) DO NOTHING
            """, nativeQuery = true)
    int enqueue(Long subscriptionId, Long userId, String payload, String hash, Instant now,
                Instant expires, Instant next);
}
