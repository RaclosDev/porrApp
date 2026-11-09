package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Sesión de juego (una quedada): tiene su propia clasificación además de la acumulada. */
@Entity
@Table(name = "score_tracker_sessions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    /** Juego al que se juega en esta sesión: cambiar de juego abre otra sesión. */
    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Builder.Default
    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();
}
