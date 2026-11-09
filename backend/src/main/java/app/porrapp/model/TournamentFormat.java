package app.porrapp.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Forma de un torneo con fase de grupos y eliminatorias que se predice entero antes de empezar: lo que
 * cambia de un torneo a otro. Un torneo nuevo se añade aquí, con sus números y sus cruces.
 *
 * @param season              temporada que se pide al proveedor de datos
 * @param bracketDeadline     hasta cuándo se admiten cuadros si la liga no dice otra cosa
 * @param bestThirds          terceros de grupo que pasan a las eliminatorias, además de los dos primeros
 * @param groupMatchesPerTeam partidos de grupo que juega cada equipo
 * @param seededGroups        los grupos están sorteados antes de tener calendario: cada equipo lleva el
 *                            suyo; si no, los grupos son los que digan los partidos del torneo
 * @param firstKnockoutRound  cruces de la primera ronda eliminatoria, en el orden del cuadro: cada lado es
 *                            un puesto de grupo ("1E", "2A") o el tercero de uno de varios grupos ("3ABCDF")
 */
public record TournamentFormat(String season, Instant bracketDeadline, int bestThirds, int groupMatchesPerTeam,
                               boolean seededGroups, List<List<String>> firstKnockoutRound) {

    /** Mundial de 48 selecciones: 12 grupos de 4, pasan los dos primeros y los 8 mejores terceros. */
    public static final TournamentFormat WORLD_CUP_2026 = new TournamentFormat(
            "2026", Instant.parse("2026-06-11T18:00:00Z"), 8, 3, true, WorldCupBracketTopology.ROUND_OF_32);

    /** Grupos tomados del calendario del torneo, sin terceros que pasen ni cuadro que predecir. */
    private static final TournamentFormat GROUPS_FROM_CALENDAR = new TournamentFormat(null, null, 0, 0, false, List.of());

    private static final Map<String, TournamentFormat> REGISTERED = Map.of(
            Competition.WORLD_CUP_EXTERNAL_ID, WORLD_CUP_2026);

    /** Formato del torneo, o {@code null} si la competición no es un torneo con grupos que se prediga entero. */
    public static TournamentFormat registered(Competition competition) {
        if (competition == null || competition.getOwnerLeague() != null || competition.getExternalId() == null) return null;
        return REGISTERED.get(competition.getExternalId().toLowerCase());
    }

    /** Formato con el que se clasifican los grupos de una competición: el suyo o, si no tiene, el de su calendario. */
    public static TournamentFormat of(Competition competition) {
        TournamentFormat format = registered(competition);
        return format != null ? format : GROUPS_FROM_CALENDAR;
    }

    /** Identificadores externos de los torneos con grupos que se predicen enteros. */
    public static Set<String> registeredExternalIds() {
        return REGISTERED.keySet();
    }

    /** Algún tercero pasa: los terceros se ordenan entre sí y los peores quedan eliminados. */
    public boolean ranksThirds() {
        return bestThirds > 0;
    }
}
