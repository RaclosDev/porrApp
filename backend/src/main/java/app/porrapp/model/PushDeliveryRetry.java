package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@org.hibernate.annotations.DynamicUpdate
@Table(name = "push_delivery_retries")
@Getter @Setter @NoArgsConstructor
public class PushDeliveryRetry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long subscriptionId;
    private Long userId;
    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;
    private String payloadHash;
    private Instant createdAt;
    private Instant expiresAt;
    private Instant nextAttemptAt;
    private int attempts;
    private java.util.UUID receiptToken;
    private boolean receiptExpected;
    private Instant acceptedAt;
    private Instant receivedAt;
    private Instant finishedAt;
}
