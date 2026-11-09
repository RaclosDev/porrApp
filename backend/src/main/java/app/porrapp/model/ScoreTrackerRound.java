package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Una partida (o ronda) apuntada en una sesión de un marcador. */
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

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
