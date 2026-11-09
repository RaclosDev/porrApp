package app.porrapp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Pichichi de una porra. En las ligas sin cuadro es la elección entera; en el cuadro de un torneo con
 * grupos el nombre va dentro del cuadro y esta fila solo guarda el jugador que le asigna el administrador,
 * que deja de valer si el participante cambia el nombre.
 */
@Entity
@Table(name = "scorer_picks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScorerPick {

    @Id
    @Column(name = "prediction_id")
    private Long predictionId;

    /** Lo que escribió o eligió el participante. */
    @Column(name = "written_name", nullable = false, length = 120)
    private String writtenName;

    /** Jugador al que se refiere, si se sabe: elegido de la lista o asignado por el administrador. */
    @Column(name = "player_id")
    private String playerId;

    @Column(name = "player_name")
    private String playerName;

    @Column(name = "resolved_by_admin", nullable = false)
    private boolean resolvedByAdmin;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
