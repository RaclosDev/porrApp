package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Una ronda apuntada en una partida: puntos de quienes la jugaron. */
@Entity
@Table(name = "score_tracker_rounds")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(length = 120)
    private String note;

    /** Quién la apuntó (cualquier miembro puede hacerlo). */
    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
