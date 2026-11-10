package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Día de juego de una liga de marcador (una quedada): tiene sus asistentes y una o varias partidas. */
@Entity
@Table(name = "score_days")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    @Builder.Default
    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    /** Cuándo se dio por terminado el día; vacío mientras sigue en curso. */
    @Column(name = "closed_at")
    private Instant closedAt;

    public boolean isOpen() {
        return closedAt == null;
    }
}
