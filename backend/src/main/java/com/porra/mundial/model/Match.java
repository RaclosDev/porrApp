package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Entidad 'Match' (Partido Real).
 * Representa un partido de fútbol real del torneo oficial.
 * Se sincroniza continuamente con proveedores deportivos para obtener resultados en vivo.
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

    /** Competición a la que pertenece este partido (ej. Mundial 2026, Euro 2024). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id")
    private Competition competition;

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

    /** El ID que usa la API externa oficial para no crear duplicados al sincronizar. */
    private String externalId;

    /** El minuto actual del partido si está en directo (ej. "45'", "HT", "FT"). */
    private String displayClock;

    /** Estado canónico normalizado del partido (ej. SCHEDULED, LIVE, FINISHED, POSTPONED). */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30)
    @Builder.Default
    private MatchStatusNormalized status = MatchStatusNormalized.SCHEDULED;

    /** Puntos Fair Play del equipo local en este partido (tarjetas). */
    @Column(name = "home_fair_play")
    @Builder.Default
    private Integer homeFairPlay = 0;

    /** Puntos Fair Play del equipo visitante en este partido (tarjetas). */
    @Column(name = "away_fair_play")
    @Builder.Default
    private Integer awayFairPlay = 0;
}
