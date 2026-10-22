package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 *  Entidad 'ExtraPrediction' (Predicciones Extra).
 * Tabla que almacena las predicciones "singulares" de una apuesta que no encajan en el Bracket.
 * Ej: El Pichichi, o el Campeón Final de forma directa.
 * Comparte el mismo ID que la Bet (Relación 1 a 1).
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_extra")
public class ExtraPrediction {

    /** Identificador compartido con Bet. */
    @Id
    @Column(name = "bet_id")
    private Long id;

    /** Referencia 1 a 1 con la apuesta padre. */
    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "bet_id")
    private Bet bet;

    /** Nombre del jugador máximo goleador (Pichichi). Texto libre o estandarizado. */
    @Column(name = "top_scorer", length = 255)
    private String topScorer;

    /** Equipo campeón del torneo. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "champion_team_id", nullable = false)
    private Team championTeam;

    /** (Opcional) Equipo que queda en tercer puesto, si el formato lo exige. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "third_place_team_id")
    private Team thirdPlaceTeam;
}
