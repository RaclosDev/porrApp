package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/** Lo que sumó un jugador en una partida. */
@Entity
@Table(name = "score_tracker_scores")
@IdClass(ScoreTrackerScore.Key.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerScore {

    @Id
    @Column(name = "round_id")
    private Long roundId;

    @Id
    @Column(name = "player_id")
    private Long playerId;

    @Column(nullable = false)
    private int points;

    @EqualsAndHashCode
    public static class Key implements Serializable {
        private Long roundId;
        private Long playerId;
    }
}
