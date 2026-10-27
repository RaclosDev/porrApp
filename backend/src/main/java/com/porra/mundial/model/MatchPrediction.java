package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

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

    private Integer pointsAwarded;

    private Boolean isExactScore;

    private Boolean isCorrectSign;

    @Column(name = "scoring_details", length = 255)
    private String scoringDetails;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
