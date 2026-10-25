package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO que representa un partido del calendario junto con el pronóstico del usuario y su estado de bloqueo y puntos.
 */
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
    private LocalDateTime matchDate;
    private String round;
    private String groupName;
    private Boolean finished;
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

    // Puntuación calculada si el partido ha finalizado
    private Integer pointsAwarded;
    private Boolean isExactScore;
    private Boolean isCorrectSign;
    private String scoringDetails;
}
