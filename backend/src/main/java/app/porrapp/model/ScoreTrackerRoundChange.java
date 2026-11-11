package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Registro persistente de quién apuntó, corrigió o borró una ronda. */
@Entity
@Table(name = "score_tracker_round_changes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerRoundChange {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    @Column(name = "round_id", nullable = false)
    private Long roundId;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(nullable = false, length = 10)
    private String action;

    @Column(name = "before_state", columnDefinition = "text")
    private String beforeState;

    @Column(name = "after_state", columnDefinition = "text")
    private String afterState;

    @Builder.Default
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt = Instant.now();
}
