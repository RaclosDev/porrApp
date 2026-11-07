package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import tools.jackson.databind.annotation.JsonSerialize;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchdayFixturePredictionDTO {

    private Long matchId;
    private String homeTeam;
    private String awayTeam;
    private Long homeTeamId;
    private Long awayTeamId;
    private String homeTeamLogo;
    private String awayTeamLogo;
    @JsonSerialize(using = MadridDateTimeSerializer.class)
    private Instant matchDate;
    private String round;
    private String groupName;
    /** Competición del partido, solo en las ligas que juntan varias. */
    private String competitionName;
    /** Deporte del partido ({@code Sport}): en los que no admiten empate no se ofrece la X. */
    private String sport;
    private Boolean finished;
    private String status;
    private Integer actualHomeScore;
    private Integer actualAwayScore;
    private String displayClock;

    // Pronóstico del usuario
    private Integer predHomeScore;
    private Integer predAwayScore;
    private String predSign;

    // Estado del partido y cierre
    private boolean locked;
    private String lockReason;
    /** Cuándo deja de poder cambiarse el pronóstico (puede ser antes del partido). */
    @JsonSerialize(using = MadridDateTimeSerializer.class)
    private Instant lockAt;

    // Puntuación calculada si el partido ha finalizado
    private Integer pointsAwarded;
    private Boolean isExactScore;
    private Boolean isCorrectSign;
    private String scoringDetails;
}
