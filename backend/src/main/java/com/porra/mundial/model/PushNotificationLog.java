package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Un aviso push que llegó a al menos un dispositivo del usuario. */
@Entity
@Table(name = "push_notification_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PushNotificationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 500)
    private String body;

    /** Ruta de la app a la que lleva el aviso. */
    private String url;

    @Builder.Default
    @Column(name = "sent_at", nullable = false)
    private Instant sentAt = Instant.now();
}
