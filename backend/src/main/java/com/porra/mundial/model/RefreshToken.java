package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Un refresh token de una familia. Solo se guarda su SHA-256 en hexadecimal. */
@Entity
@Table(name = "refresh_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Cuándo se cambió por el siguiente. Un token rotado que vuelve a llegar es una reutilización. */
    @Column(name = "rotated_at")
    private Instant rotatedAt;
}
