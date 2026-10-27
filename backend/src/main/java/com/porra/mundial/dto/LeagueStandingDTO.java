package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para la tabla de clasificación oficial de una liga regular (LaLiga, Premier League, etc.)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeagueStandingDTO {
    private int rank;
    private String teamName;
    private String teamLogo;
    private int points;
    private int gamesPlayed;
    private int wins;
    private int ties;
    private int losses;
    private int goalDiff;
    private int goalsFor;
    private int goalsAgainst;
}
