package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;


/**
 * Entidad 'MatchPrediction' (Pronóstico de Partido Directo).
 * Representa el pronóstico de un usuario (1X2 y marcador) para un partido específico.
 * Mapeada a la tabla "pronosticos_partido".
 */
@Entity
@Table(name = "pronosticos_partido", uniqueConstraints = {
        @UniqueConstraint(name = "uq_prediction_match", columnNames = {"prediction_id", "match_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private Prediction prediction;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    private Integer homeScore;

    private Integer awayScore;

    @Column(name = "prediction_sign", length = 5)
    private String predictionSign; // "1", "X", "2"

    /** Pelea de MMA: método elegido (KO_TKO, SUBMISSION o DECISION); null si solo se predice el ganador. */
    @Column(name = "predicted_method", length = 20)
    private String predictedMethod;

    /** Pelea de MMA: asalto elegido, solo con un método que acaba antes del límite. */
    @Column(name = "predicted_round")
    private Integer predictedRound;

    private Integer pointsAwarded;

    /** Fórmula 1: pilotos ({@code race_drivers}) elegidos para el podio, la pole y la vuelta rápida. */
    @Column(name = "race_first_driver_id")
    private Long raceFirstDriverId;
    @Column(name = "race_second_driver_id")
    private Long raceSecondDriverId;
    @Column(name = "race_third_driver_id")
    private Long raceThirdDriverId;
    @Column(name = "race_pole_driver_id")
    private Long racePoleDriverId;
    @Column(name = "race_fastest_lap_driver_id")
    private Long raceFastestLapDriverId;

    private Boolean isExactScore;

    private Boolean isCorrectSign;

    @Column(name = "scoring_details", length = 255)
    private String scoringDetails;

    @Builder.Default
    private Instant createdAt = Instant.now();

    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
