package app.porrapp.model;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Forma de un torneo con fase de grupos y eliminatorias que se predice entero antes de empezar: lo que
 * cambia de un torneo a otro. Un torneo nuevo es una entrada de {@code seed/tournament-formats.json},
 * con sus números y sus cruces; el código no sabe de ninguno en concreto.
 *
 * @param season              temporada que se pide al proveedor de datos
 * @param bracketDeadline     hasta cuándo se admiten cuadros si la liga no dice otra cosa
 * @param bestThirds          terceros de grupo que pasan a las eliminatorias, además de los dos primeros
 * @param groupMatchesPerTeam partidos de grupo que juega cada equipo
 * @param seededGroups        los grupos están sorteados antes de tener calendario: cada equipo lleva el
 *                            suyo; si no, los grupos son los que digan los partidos del torneo
 * @param thirdPlaceMatch     los perdedores de las semifinales juegan por el tercer puesto
 * @param tiebreak            reglamento con el que se desempatan sus grupos: el de su organizador; si no
 *                            se dice, el de la FIFA
 * @param firstKnockoutRound  cruces de la primera ronda eliminatoria, en el orden del cuadro: cada lado es
 *                            un puesto de grupo ("1E", "2A") o el tercero de uno de varios grupos ("3ABCDF").
 *                            Su tamaño dice en qué ronda empieza el cuadro (16 cruces, dieciseisavos; 8, octavos…)
 */
public record TournamentFormat(String season, Instant bracketDeadline, int bestThirds, int groupMatchesPerTeam,
                               boolean seededGroups, boolean thirdPlaceMatch, GroupTiebreak tiebreak,
                               List<List<String>> firstKnockoutRound) {

    static final String REGISTRY = "/seed/tournament-formats.json";

    /** Rondas eliminatorias que se predicen, de la más grande a las semifinales; después va la final. */
    public static final List<KnockoutRound> ROUNDS = List.of(
            KnockoutRound.ROUND_OF_32, KnockoutRound.ROUND_OF_16, KnockoutRound.QUARTER_FINAL, KnockoutRound.SEMI_FINAL);

    /** Grupos tomados del calendario del torneo, sin terceros que pasen ni cuadro que predecir. */
    private static final TournamentFormat GROUPS_FROM_CALENDAR =
            new TournamentFormat(null, null, 0, 0, false, false, GroupTiebreak.FIFA, List.of());

    private static final Map<String, TournamentFormat> REGISTERED = load();

    public TournamentFormat {
        tiebreak = tiebreak == null ? GroupTiebreak.FIFA : tiebreak;
        firstKnockoutRound = firstKnockoutRound == null ? List.of()
                : firstKnockoutRound.stream().map(List::copyOf).toList();
    }

    private static Map<String, TournamentFormat> load() {
        try (InputStream in = TournamentFormat.class.getResourceAsStream(REGISTRY)) {
            Map<String, TournamentFormat> formats = JsonMapper.builder().build()
                    .readValue(in, new TypeReference<Map<String, TournamentFormat>>() {
                    });
            formats.forEach((externalId, format) -> format.check(externalId));
            return Map.copyOf(formats);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer " + REGISTRY, e);
        }
    }

    /** Un formato mal escrito se detecta al arrancar, no al puntuar un cuadro. */
    private void check(String externalId) {
        if (firstRound() == null) {
            throw new IllegalStateException(externalId + ": la primera ronda debe tener 2, 4, 8 o 16 cruces");
        }
        long thirdSlots = firstKnockoutRound.stream().flatMap(List::stream).filter(slot -> slot.startsWith("3")).count();
        if (thirdSlots != bestThirds) {
            throw new IllegalStateException(externalId + ": hay " + thirdSlots + " huecos de terceros y pasan " + bestThirds);
        }
        if (firstKnockoutRound.stream().anyMatch(pair -> pair.size() != 2)) {
            throw new IllegalStateException(externalId + ": cada cruce tiene dos lados");
        }
    }

    /** Formato del torneo, o {@code null} si la competición no es un torneo con grupos que se prediga entero. */
    public static TournamentFormat registered(Competition competition) {
        if (competition == null || competition.getOwnerLeague() != null || competition.getExternalId() == null) return null;
        return REGISTERED.get(competition.getExternalId().toLowerCase());
    }

    /** Formato registrado con ese identificador externo, o {@code null}. */
    public static TournamentFormat registered(String externalId) {
        return externalId == null ? null : REGISTERED.get(externalId.toLowerCase());
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

    /** Ronda en la que empieza el cuadro, según sus cruces; {@code null} si no tiene cuadro que predecir. */
    public KnockoutRound firstRound() {
        return switch (firstKnockoutRound.size()) {
            case 16 -> KnockoutRound.ROUND_OF_32;
            case 8 -> KnockoutRound.ROUND_OF_16;
            case 4 -> KnockoutRound.QUARTER_FINAL;
            case 2 -> KnockoutRound.SEMI_FINAL;
            default -> null;
        };
    }

    /** Rondas que juega el torneo antes de la final, desde la primera. */
    public List<KnockoutRound> rounds() {
        KnockoutRound first = firstRound();
        return first == null ? List.of() : ROUNDS.subList(ROUNDS.indexOf(first), ROUNDS.size());
    }

    /** Letras de los grupos, deducidas de los cruces: todo grupo coloca a su primero en alguno. */
    public Set<String> groups() {
        Set<String> groups = new TreeSet<>();
        for (List<String> pair : firstKnockoutRound) {
            for (String slot : pair) {
                if (!slot.startsWith("3")) groups.add(slot.substring(1));
            }
        }
        return groups;
    }
}
