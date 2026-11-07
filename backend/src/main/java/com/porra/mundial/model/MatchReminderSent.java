package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/**
 * Recordatorio ya enviado a un usuario: por un partido sin predicción ({@link #MATCH}) o por una jornada de
 * superviviente sin equipo elegido ({@link #survivor}), identificada por uno de sus partidos.
 */
@Entity
@Table(name = "match_reminders_sent")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class MatchReminderSent {

    /** Aviso de partido sin predecir. */
    public static final String MATCH = "MATCH";

    /** Aviso de jornada sin elegir equipo en una liga superviviente. */
    public static String survivor(Long leagueId) {
        return "SURVIVOR:" + leagueId;
    }

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
        @Column(name = "kind")
        private String kind;

        public Key(Long userId, Long matchId) {
            this(userId, matchId, MATCH);
        }
    }
}
