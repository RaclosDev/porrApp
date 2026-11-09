package app.porrapp.dto;

import app.porrapp.model.KnockoutRound;
import app.porrapp.model.TournamentFormat;

import java.util.List;

/**
 * Forma de un torneo con fase de grupos, para pintar y rellenar su cuadro.
 *
 * @param groups             letras de sus grupos, en orden
 * @param bestThirds         terceros de grupo que pasan a las eliminatorias
 * @param thirdPlaceMatch    se juega el partido por el tercer puesto
 * @param firstRound         ronda en la que empieza el cuadro, con el nombre con el que se guarda:
 *                           "r32", "r16", "qf" o "sf"
 * @param firstKnockoutRound cruces de esa ronda en el orden del cuadro: un puesto de grupo ("1E", "2A")
 *                           o el tercero de uno de varios grupos ("3ABCDF")
 */
public record TournamentFormatDTO(List<String> groups, int bestThirds, boolean thirdPlaceMatch, String firstRound,
                                  List<List<String>> firstKnockoutRound) {

    public static TournamentFormatDTO of(TournamentFormat format) {
        return new TournamentFormatDTO(List.copyOf(format.groups()), format.bestThirds(), format.thirdPlaceMatch(),
                key(format.firstRound()), format.firstKnockoutRound());
    }

    static String key(KnockoutRound round) {
        return switch (round) {
            case ROUND_OF_32 -> "r32";
            case ROUND_OF_16 -> "r16";
            case QUARTER_FINAL -> "qf";
            default -> "sf";
        };
    }
}
