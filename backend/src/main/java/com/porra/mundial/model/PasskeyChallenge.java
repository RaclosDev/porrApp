package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Reto de un registro o un inicio de sesión con llave de acceso en curso. Se guarda en la base y no
 * en memoria para que funcione con varias instancias. Un solo uso: se borra al comprobarlo.
 */
@Entity
@Table(name = "passkey_challenges")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PasskeyChallenge {

    @Id
    @Column(length = 64)
    private String id;

    /** Cuenta que añade la llave; null en los inicios de sesión. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "request_json", nullable = false, columnDefinition = "TEXT")
    private String requestJson;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
