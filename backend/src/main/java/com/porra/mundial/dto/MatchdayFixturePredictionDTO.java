package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import tools.jackson.databind.annotation.JsonSerialize;

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
    private LocalDateTime matchDate;
    private String round;
    private String groupName;
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
    private LocalDateTime lockAt;

    // Puntuación calculada si el partido ha finalizado
    private Integer pointsAwarded;
    private Boolean isExactScore;
    private Boolean isCorrectSign;
    private String scoringDetails;
}
