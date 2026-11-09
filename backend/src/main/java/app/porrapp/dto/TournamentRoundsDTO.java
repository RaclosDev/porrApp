package app.porrapp.dto;

import app.porrapp.model.Competition;
import app.porrapp.model.TournamentFormat;

/**
 * Rondas eliminatorias que juega un torneo con fase de grupos: lo justo para nombrar las de una liga
 * (clasificación, gráfica y reglas de puntos) sin pedir la forma entera de su cuadro.
 *
 * @param firstRound      ronda en la que empieza el cuadro, con el nombre con el que se guarda:
 *                        "r32", "r16", "qf" o "sf"
 * @param thirdPlaceMatch se juega el partido por el tercer puesto
 */
public record TournamentRoundsDTO(String firstRound, boolean thirdPlaceMatch) {

    /** Rondas del torneo de la competición, o {@code null} si no es un torneo con grupos. */
    public static TournamentRoundsDTO of(Competition competition) {
        TournamentFormat format = competition == null ? null : competition.tournamentFormat();
        return format == null ? null
                : new TournamentRoundsDTO(TournamentFormatDTO.key(format.firstRound()), format.thirdPlaceMatch());
    }
}
