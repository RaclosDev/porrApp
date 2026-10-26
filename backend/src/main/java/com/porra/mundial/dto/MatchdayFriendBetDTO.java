package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO para visualizar los pronósticos de los miembros de un grupo para un partido concreto.
 * Oculta los marcadores si el partido no ha comenzado (salvo para el propio usuario).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchdayFriendBetDTO {
    private Long userId;
    private String participantName;
    private String avatarUrl;
    private Integer homeScore;
    private Integer awayScore;
    private String sign;
    private Integer pointsAwarded;
    private Boolean isExactScore;
    private Boolean isCorrectSign;
    private String scoringDetails;
    private LocalDateTime updatedAt;
    private boolean isCaller;
    private boolean hasPredicted;
}
