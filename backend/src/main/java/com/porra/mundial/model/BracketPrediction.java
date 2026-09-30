package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 🏆 Entidad 'BracketPrediction' (Pronóstico del Cuadro Eliminatorio).
 * Representa una predicción individual de un emparejamiento eliminatorio (ej. Octavos o Cuartos).
 * Una apuesta (Bet) tiene múltiples registros de estos.
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_cuadro")
public class BracketPrediction {

    /** Identificador autogenerado. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Referencia a la apuesta padre. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bet_id", nullable = false)
    private Bet bet;

    /** Fase del torneo (r32, r16, qf, sf, final). */
    @Column(nullable = false, length = 20)
    private String phase;

    /** Índice ordinal del partido dentro de esa fase (ej. el partido 0 de Cuartos). */
    @Column(name = "match_index", nullable = false)
    private Integer matchIndex;

    /** Equipo local del emparejamiento. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "home_team_id")
    private Team homeTeam;

    /** Equipo visitante del emparejamiento. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "away_team_id")
    private Team awayTeam;

    /** Equipo que el usuario ha predecido que ganará este emparejamiento. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "winner_team_id", nullable = false)
    private Team winnerTeam;
}
