package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Marcador de un juego (de mesa, de cartas…). Lo crea un usuario, que es el único que apunta
 * partidas; quien tiene el código lo ve en directo.
 */
@Entity
@Table(name = "score_trackers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTracker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    @Column(nullable = false, length = 120)
    private String name;

    /** Lo que se cuenta: «puntos», «fichas»… */
    @Builder.Default
    @Column(nullable = false, length = 30)
    private String unit = "puntos";

    /** Gana quien menos suma (golf, chinchón…). */
    @Builder.Default
    @Column(name = "lower_wins", nullable = false)
    private boolean lowerWins = false;

    @Column(name = "join_code", nullable = false, unique = true, length = 12)
    private String joinCode;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
