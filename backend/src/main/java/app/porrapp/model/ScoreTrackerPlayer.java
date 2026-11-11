package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

/** Jugador de una liga de marcador: tiene nombre y no hace falta que tenga cuenta; quien tiene cuenta puede reclamarlo. */
@Entity
@Table(name = "score_tracker_players")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "league_id", nullable = false)
    private Long leagueId;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(nullable = false)
    private int position;

    /** Cuenta que ha reclamado este jugador como suyo; casi siempre vacío (los jugadores son solo un nombre). */
    @Column(name = "user_id")
    private Long userId;
}
