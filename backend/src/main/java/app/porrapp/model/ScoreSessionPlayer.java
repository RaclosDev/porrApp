package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

/** Quien juega una partida: solo sus participantes puntúan y cuentan para ganarla. */
@Entity
@Table(name = "score_session_players")
@IdClass(ScoreSessionPlayer.Key.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class ScoreSessionPlayer {

    @Id
    @Column(name = "session_id")
    private Long sessionId;

    @Id
    @Column(name = "player_id")
    private Long playerId;

    @EqualsAndHashCode
    @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Long sessionId;
        private Long playerId;
    }
}
