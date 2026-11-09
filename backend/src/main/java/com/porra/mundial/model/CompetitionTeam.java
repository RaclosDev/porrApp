package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Participación de un equipo en una competición. Un equipo juega varias (España, el Mundial y la
 * Eurocopa), y en cada torneo con fase de grupos cae en un grupo distinto: el grupo es de la
 * participación, no del equipo.
 */
@Entity
@Table(name = "competition_teams")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CompetitionTeam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /** Grupo en el que juega la fase de grupos ("A", "B"...), si el torneo la tiene y ya está sorteada. */
    @Column(name = "group_name", length = 50)
    private String groupName;
}
