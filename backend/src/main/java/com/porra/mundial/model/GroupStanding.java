package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Fila de la clasificación real de un grupo: un equipo en la fase de grupos de un torneo, con sus
 * estadísticas y su posición y estado matemático ya calculados. Es también lo que dice qué equipos
 * juegan cada grupo de cada competición.
 */
@Entity
@Table(name = "group_standings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupStanding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Torneo al que pertenece el grupo. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "team_id")
    private Team team;

    /** Nombre del grupo dentro del torneo ("A", "B"...). */
    @Column(name = "group_name", length = 50)
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

    /** Número de partidos de grupo jugados hasta el momento. */
    @Builder.Default
    private Integer matchesPlayed = 0;

    /** Puntos de fair play (tarjetas amarillas/rojas) - último criterio de desempate en la vida real. */
    @Column(name = "fair_play_points")
    @Builder.Default
    private Integer fairPlayPoints = 0;

    /** Posición calculada en el grupo, desde 1. */
    @Column(name = "position")
    @Builder.Default
    private Integer position = 0;

    /** Estado matemático: 0 en juego, 1-4 puesto asegurado, 5 entre los dos primeros, -1 eliminado. */
    @Column(name = "status")
    @Builder.Default
    private Integer status = 0;
}
