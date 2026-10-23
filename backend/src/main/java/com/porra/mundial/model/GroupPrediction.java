package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entidad 'GroupPrediction' (Pronostico de Fase de Grupos).
 * Almacena en que posicion predice el participante que quedara un equipo en su grupo.
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_grupo")
public class GroupPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private Prediction prediction;

    @Column(name = "group_name", nullable = false, length = 2)
    private String groupName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @Column(name = "position", nullable = false)
    private Integer position;

    @Column(name = "is_best_third")
    private Boolean isBestThird;

    public Prediction getBet() {
        return prediction;
    }

    public void setBet(Prediction prediction) {
        this.prediction = prediction;
    }

    public static class GroupPredictionBuilder {
        public GroupPredictionBuilder bet(Prediction prediction) {
            this.prediction = prediction;
            return this;
        }
    }
}
