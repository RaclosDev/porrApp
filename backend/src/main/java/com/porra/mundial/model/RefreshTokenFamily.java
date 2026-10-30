package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Una sesión iniciada en un dispositivo: la cadena de refresh tokens que salen de un mismo
 * inicio de sesión. Es la fila que se bloquea al rotar o revocar, así que revocar la familia
 * alcanza también al token que otra petición esté creando en ese momento.
 */
@Entity
@Table(name = "refresh_token_families")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RefreshTokenFamily {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Caducidad absoluta: ningún token de la familia vale después, por mucho que se rote. */
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Logout o reutilización detectada. Null mientras la sesión está activa. */
    @Column(name = "revoked_at")
    private Instant revokedAt;
}
