package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeagueStandingDTO {
    /**
     * Grupo, conferencia o fase de la fila («Grupo A», «Fase suiza»…) cuando la competición tiene varias
     * tablas; null si tiene una sola. Las filas de un mismo grupo van juntas y el puesto es dentro del grupo.
     */
    private String group;
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
    /** División del equipo dentro de su conferencia (NBA: «Atlántico»…); null en las demás competiciones. */
    private String division;
    /** Racha actual (NBA: «V3», «D1»); null si la competición no la da. */
    private String streak;
    /** Nombre corto del equipo para pantallas estrechas (NBA: «76ers», «Celtics»); null si no lo hay. */
    private String teamShortName;
}
