package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entidad 'BracketPrediction' (Pronostico del Cuadro Eliminatorio).
 * Representa una prediccion individual de un emparejamiento eliminatorio.
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_cuadro")
public class BracketPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private Prediction prediction;

    @Column(nullable = false, length = 20)
    private String phase;

    @Column(name = "match_index", nullable = false)
    private Integer matchIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "home_team_id")
    private Team homeTeam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "away_team_id")
    private Team awayTeam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "winner_team_id", nullable = false)
    private Team winnerTeam;

    public Prediction getBet() {
        return prediction;
    }

    public void setBet(Prediction prediction) {
        this.prediction = prediction;
    }

    public static class BracketPredictionBuilder {
        public BracketPredictionBuilder bet(Prediction prediction) {
            this.prediction = prediction;
            return this;
        }
    }
}
