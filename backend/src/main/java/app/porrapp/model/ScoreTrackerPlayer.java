package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

/** Jugador de un marcador: solo tiene nombre, no hace falta que tenga cuenta. */
@Entity
@Table(name = "score_tracker_players")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tracker_id", nullable = false)
    private Long trackerId;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(nullable = false)
    private int position;
}
