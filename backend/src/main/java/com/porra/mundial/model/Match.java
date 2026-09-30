package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * ⚽ Entidad 'Match' (Partido Real).
 * Representa un partido de fútbol real del torneo oficial.
 * Se sincroniza continuamente con la API de ESPN para obtener resultados en vivo.
 */
@Entity
@Table(name = "matches")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Match {

    /** Identificador único interno. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Equipo que juega como local (Conectado a la tabla de Equipos). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "home_team_id")
    private Team homeTeam;

    /** Equipo que juega como visitante (Conectado a la tabla de Equipos). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "away_team_id")
    private Team awayTeam;

    /** Ganador oficial del partido (útil para desempatar penaltis en eliminatorias). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "winner_team_id")
    private Team winnerTeam;

    /** Goles que ha marcado el local. Si es 'null', el partido aún no se ha jugado. */
    private Integer homeScore;
    
    /** Goles que ha marcado el visitante. */
    private Integer awayScore;

    /** Fecha y hora del partido ajustada al horario configurado en el servidor. */
    private LocalDateTime matchDate; 

    /** ¿Ya ha pitado el árbitro el final del partido (Full Time / FT)? */
    @Builder.Default
    private Boolean finished = false;

    /** La letra del grupo (Ej: "A", "B"). Si es una final o eliminatoria, esto estará vacío. */
    @Column(name = "group_name", length = 2)
    private String groupName;

    /** En qué fase del torneo estamos: "group" (grupos), "r16" (octavos), "final", etc. */
    @Builder.Default
    private String round = "group"; 

    /** El ID que usa la API externa oficial (ESPN) para no crear duplicados al sincronizar. */
    private String externalId;

    /** El minuto actual del partido si está en directo (ej. "45'", "HT", "FT"). */
    private String displayClock;
}
