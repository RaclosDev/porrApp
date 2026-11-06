package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Código de un solo uso para abrir una sesión nueva de la misma cuenta en la app instalada en
 * iPhone. Solo se guarda el SHA-256 del código; se borra al canjearlo.
 */
@Entity
@Table(name = "session_handoffs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionHandoff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "code_hash", nullable = false, unique = true, length = 64)
    private String codeHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
