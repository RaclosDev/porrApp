package app.porrapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Jugador de la plantilla de un equipo de una competición, tal como lo da el proveedor. */
@Entity
@Table(name = "competition_players")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CompetitionPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    /** Id del jugador en el proveedor: el mismo con el que llegan sus goles. */
    @Column(name = "player_id", nullable = false)
    private String playerId;

    @Column(nullable = false)
    private String name;

    @Column(name = "short_name", nullable = false)
    private String shortName;

    @Column(nullable = false)
    private String team;

    @Column(name = "player_position", nullable = false)
    private String playerPosition;

    /** Última vez que el proveedor lo dio en una plantilla. */
    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;
}
