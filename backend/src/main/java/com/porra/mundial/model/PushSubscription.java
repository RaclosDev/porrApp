package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Un dispositivo (navegador o PWA instalada) en el que el usuario aceptó recibir avisos push. */
@Entity
@Table(name = "push_subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    /** URL del servicio push del navegador (FCM, Apple, Mozilla...). Identifica el dispositivo. */
    @Column(nullable = false, unique = true, columnDefinition = "TEXT")
    private String endpoint;

    /** Clave pública P-256 del navegador, en base64url. */
    @Column(nullable = false)
    private String p256dh;

    /** Secreto de autenticación del navegador, en base64url. */
    @Column(nullable = false)
    private String auth;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
