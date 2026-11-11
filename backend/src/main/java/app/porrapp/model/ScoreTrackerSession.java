package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Partida: una vez que se juega a un juego en un día de juego, con sus participantes y su clasificación. */
@Entity
@Table(name = "score_tracker_sessions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    /** Juego al que se juega en esta partida. */
    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "day_id", nullable = false)
    private Long dayId;

    @Builder.Default
    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    /** Cuándo se terminó; vacío mientras está abierta. Una partida terminada se puede reabrir. */
    @Column(name = "ended_at")
    private Instant endedAt;

    /** Rondas que se piensan jugar («hoy a 10»): solo sirve para avisar, la partida no se cierra sola. */
    @Column(name = "planned_rounds")
    private Integer plannedRounds;

    public boolean isOpen() {
        return endedAt == null;
    }
}
