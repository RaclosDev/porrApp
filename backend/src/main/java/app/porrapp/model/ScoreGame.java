package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Un juego de una liga de marcador (el parchís, el mus, el golf…). Una misma liga puede jugar a varios:
 * cada sesión es de un juego y cada juego se puntúa a su manera.
 */
@Entity
@Table(name = "score_games")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreGame {

    public static final String MODE_POINTS = "POINTS";
    public static final String MODE_WINS = "WINS";
    public static final String MODE_DIRECT = "DIRECT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    @Column(nullable = false, length = 60)
    private String name;

    /** Lo que se cuenta: «puntos», «fichas»… */
    @Builder.Default
    @Column(nullable = false, length = 30)
    private String unit = "puntos";

    /** Gana quien menos suma (golf, chinchón…). */
    @Builder.Default
    @Column(name = "lower_wins", nullable = false)
    private boolean lowerWins = false;

    /** Puntos por ronda, victorias por ronda o ganador directo de la partida. */
    @Builder.Default
    @Column(nullable = false, length = 10)
    private String mode = MODE_POINTS;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public boolean isWins() {
        return MODE_WINS.equals(mode) || MODE_DIRECT.equals(mode);
    }

    public boolean isDirect() {
        return MODE_DIRECT.equals(mode);
    }
}
