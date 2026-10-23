package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entidad 'ExtraPrediction' (Predicciones Extra: Goleador, Campeon).
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_extra")
public class ExtraPrediction {

    @Id
    @Column(name = "prediction_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "prediction_id")
    private Prediction prediction;

    @Column(name = "top_scorer", length = 255)
    private String topScorer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "champion_team_id", nullable = false)
    private Team championTeam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "third_place_team_id")
    private Team thirdPlaceTeam;

    public Prediction getBet() {
        return prediction;
    }

    public void setBet(Prediction prediction) {
        this.prediction = prediction;
    }

    public static class ExtraPredictionBuilder {
        public ExtraPredictionBuilder bet(Prediction prediction) {
            this.prediction = prediction;
            return this;
        }
    }
}
