package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * ⚽ Entidad 'Match' (Partido)
 * Representa un partido de fútbol real del Mundial.
 */
@Entity
@Table(name = "matches")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Match {

    // Identificador único interno
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Equipo que juega como local (Conectado a la tabla de Equipos)
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "home_team_id")
    private Team homeTeam;

    // Equipo que juega como visitante (Conectado a la tabla de Equipos)
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "away_team_id")
    private Team awayTeam;

    // Goles que ha marcado el local. Si es 'null', el partido aún no se ha jugado.
    private Integer homeScore;
    
    // Goles que ha marcado el visitante.
    private Integer awayScore;

    // Fecha y hora del partido ajustada al horario de España.
    private LocalDateTime matchDate; 

    // ¿Ya ha pitado el árbitro el final del partido?
    @Builder.Default
    private Boolean finished = false;

    // La letra del grupo (Ej: "A", "B"). Si es una final o eliminatoria, esto estará vacío.
    @Column(name = "group_name", length = 2)
    private String groupName;

    // En qué fase del torneo estamos: "group" (grupos), "r16" (octavos), "final", etc.
    @Builder.Default
    private String round = "group"; 

    // El ID que usa la API externa oficial del Mundial (para no confundirnos al sincronizar)
    private String externalId;

    // En qué estadio juegan (nos sirve para saber su zona horaria local en América)
    private String stadiumId; 
}
