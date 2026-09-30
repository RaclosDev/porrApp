package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 🅰️ Entidad 'GroupPrediction' (Pronóstico de Fase de Grupos).
 * Almacena en qué posición exacta predice el usuario que quedará un equipo en su grupo.
 * Hay un registro por cada equipo en cada grupo pronosticado en una apuesta.
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_grupo")
public class GroupPrediction {

    /** Identificador único autogenerado. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Referencia a la apuesta a la que pertenece esta predicción. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bet_id", nullable = false)
    private Bet bet;

    /** Letra del Grupo (A, B, C...). */
    @Column(name = "group_name", nullable = false, length = 2)
    private String groupName;

    /** Equipo al que se le está asignando la posición. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /** Posición pronosticada (1, 2, 3, 4). */
    @Column(name = "position", nullable = false)
    private Integer position;

    /** Booleano indicando si pasa como uno de los "Mejores Terceros" (para formatos de 24 equipos como Eurocopa). */
    @Column(name = "is_best_third")
    private Boolean isBestThird;
}
