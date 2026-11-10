package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/** Un asistente a un día de juego. */
@Entity
@Table(name = "score_day_players")
@IdClass(ScoreDayPlayer.Key.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class ScoreDayPlayer {

    @Id
    @Column(name = "day_id")
    private Long dayId;

    @Id
    @Column(name = "player_id")
    private Long playerId;

    @EqualsAndHashCode
    @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Long dayId;
        private Long playerId;
    }
}
