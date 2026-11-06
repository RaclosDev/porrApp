package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** Recordatorio ya enviado a un usuario por un partido sin predicción. */
@Entity
@Table(name = "match_reminders_sent")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class MatchReminderSent {

    @EmbeddedId
    private Key id;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "user_id")
        private Long userId;
        @Column(name = "match_id")
        private Long matchId;
    }
}
