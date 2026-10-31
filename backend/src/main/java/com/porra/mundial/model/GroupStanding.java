package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad 'GroupStanding' (Clasificación Oficial de Grupos Reales).
 * Sirve como un "espejo" de los puntos reales que tiene cada equipo en el torneo oficial (ESPN).
 * Almacena estadísticas de la fase de grupos y la posición/estado matemático materializado.
 */
@Entity
@Table(name = "group_standings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupStanding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "team_id")
    private Team team;

    /** Letra del grupo (A-L). */
    @Column(name = "group_name", length = 2)
    private String groupName;

    /** Puntos totales conseguidos en la fase de grupos (3 por victoria, 1 empate). */
    @Builder.Default
    private Integer points = 0;

    /** Diferencia de goles (Goles a Favor menos Goles en Contra). */
    @Builder.Default
    private Integer goalDiff = 0;

    /** Goles a favor (sirve de desempate si la diferencia de goles es igual). */
    @Builder.Default
    private Integer goalsFor = 0;

    /** Número de partidos jugados hasta el momento (máximo 3). */
    @Builder.Default
    private Integer matchesPlayed = 0;

    /** Puntos de fair play (tarjetas amarillas/rojas) - último criterio de desempate en la vida real. */
    @Column(name = "fair_play_points")
    @Builder.Default
    private Integer fairPlayPoints = 0;

    /** Posición calculada en el grupo (1 a 4). */
    @Column(name = "position")
    @Builder.Default
    private Integer position = 0;

    /** Estado matemático: 0 en juego, 1-4 puesto asegurado, 5 entre los dos primeros, -1 eliminado. */
    @Column(name = "status")
    @Builder.Default
    private Integer status = 0;
}
