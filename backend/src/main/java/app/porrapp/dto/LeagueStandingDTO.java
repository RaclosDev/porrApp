package app.porrapp.dto;

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
    /** Nombre corto del equipo para pantallas estrechas («Bills», «76ers»); null si el proveedor no lo da. */
    private String teamShortName;
    private String teamLogo;
    /** Puesto en su conferencia para los playoffs de la NFL (1-7 entran); null en el resto de competiciones. */
    private Integer playoffSeed;
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
}
