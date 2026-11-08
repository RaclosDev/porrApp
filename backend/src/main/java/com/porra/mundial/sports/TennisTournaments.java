package com.porra.mundial.sports;

import com.porra.mundial.model.TennisScope;
import com.porra.mundial.model.TennisTour;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Torneos de tenis que se pueden jugar en PorrApp: los Grand Slams, los Masters 1000, los WTA 1000 y las
 * finales de temporada (ATP Finals y WTA Finals). Cada cuadro individual es una competición:
 * {@code tennis.atp.<id>} el masculino y {@code tennis.wta.<id>} el femenino, con el id del torneo en ESPN
 * (el mismo cada año: Roland Garros 2026 es el evento 172-2026).
 */
public final class TennisTournaments {

    public static final String EXTERNAL_ID_PREFIX = "tennis.";
    private static final Pattern EXTERNAL_ID = Pattern.compile("tennis\\.(atp|wta)\\.(\\d{1,6})");

    public enum Level { GRAND_SLAM, MASTERS_1000, FINALS }

    public enum Draw {
        MEN("atp", "mens-singles", "masculino"),
        WOMEN("wta", "womens-singles", "femenino");

        /** Circuito en las URL de ESPN. */
        public final String tour;
        /** Cuadro individual del torneo en el marcador de ESPN. */
        public final String grouping;
        final String label;

        Draw(String tour, String grouping, String label) {
            this.tour = tour;
            this.grouping = grouping;
            this.label = label;
        }
    }

    /**
     * @param espnId id del torneo en ESPN, en el circuito de cada cuadro
     * @param name   nombre visible, sin el cuadro
     * @param draws  cuadros individuales que se juegan: el masculino, el femenino o los dos
     */
    public record Tournament(int espnId, String name, Level level, List<Draw> draws) {
        /** Nombre de la competición de un cuadro: con el cuadro solo si el torneo tiene los dos. */
        public String competitionName(Draw draw) {
            return draws.size() > 1 ? name + " · " + draw.label : name;
        }

        public String externalId(Draw draw) {
            return EXTERNAL_ID_PREFIX + draw.tour + "." + espnId;
        }
    }

    private static final List<Draw> BOTH = List.of(Draw.MEN, Draw.WOMEN);
    private static final List<Draw> MEN_ONLY = List.of(Draw.MEN);
    private static final List<Draw> WOMEN_ONLY = List.of(Draw.WOMEN);

    /**
     * El catálogo. Los WTA 1000 que no se juegan junto a un Masters (Doha, Dubái, Pekín y Wuhan) cuentan como
     * Masters 1000: es la misma categoría en el circuito femenino. Dubái y Pekín tienen también un ATP 500 en
     * el mismo evento, que no entra.
     */
    public static final List<Tournament> ALL = List.of(
            new Tournament(154, "Open de Australia", Level.GRAND_SLAM, BOTH),
            new Tournament(172, "Roland Garros", Level.GRAND_SLAM, BOTH),
            new Tournament(188, "Wimbledon", Level.GRAND_SLAM, BOTH),
            new Tournament(189, "US Open", Level.GRAND_SLAM, BOTH),
            new Tournament(256, "WTA 1000 de Doha", Level.MASTERS_1000, WOMEN_ONLY),
            new Tournament(25, "WTA 1000 de Dubái", Level.MASTERS_1000, WOMEN_ONLY),
            new Tournament(411, "Indian Wells", Level.MASTERS_1000, BOTH),
            new Tournament(713, "Miami Open", Level.MASTERS_1000, BOTH),
            new Tournament(42, "Masters de Montecarlo", Level.MASTERS_1000, MEN_ONLY),
            new Tournament(413, "Mutua Madrid Open", Level.MASTERS_1000, BOTH),
            new Tournament(414, "Internazionali de Roma", Level.MASTERS_1000, BOTH),
            new Tournament(421, "Abierto de Canadá", Level.MASTERS_1000, BOTH),
            new Tournament(718, "Cincinnati Open", Level.MASTERS_1000, BOTH),
            new Tournament(959, "WTA 1000 de Pekín", Level.MASTERS_1000, WOMEN_ONLY),
            new Tournament(315, "Masters de Shanghái", Level.MASTERS_1000, MEN_ONLY),
            new Tournament(381, "WTA 1000 de Wuhan", Level.MASTERS_1000, WOMEN_ONLY),
            new Tournament(13, "Masters de París", Level.MASTERS_1000, MEN_ONLY),
            new Tournament(382, "WTA Finals", Level.FINALS, WOMEN_ONLY),
            new Tournament(339, "ATP Finals", Level.FINALS, MEN_ONLY));

    /** Cuadro de una competición de tenis. */
    public record Ref(Tournament tournament, Draw draw) {
        /** Sets que hay que ganar: tres en los Grand Slams masculinos, dos en el resto. */
        public int setsToWin() {
            return tournament.level() == Level.GRAND_SLAM && draw == Draw.MEN ? 3 : 2;
        }
    }

    private TennisTournaments() {
    }

    public static boolean isTennis(String externalId) {
        return externalId != null && externalId.trim().toLowerCase(Locale.ROOT).startsWith(EXTERNAL_ID_PREFIX);
    }

    /** Torneo y cuadro de un id externo del catálogo; vacío si no es uno de ellos. */
    public static Optional<Ref> parse(String externalId) {
        if (externalId == null) return Optional.empty();
        Matcher matcher = EXTERNAL_ID.matcher(externalId.trim().toLowerCase(Locale.ROOT));
        if (!matcher.matches()) return Optional.empty();
        Draw draw = "wta".equals(matcher.group(1)) ? Draw.WOMEN : Draw.MEN;
        int id = Integer.parseInt(matcher.group(2));
        return ALL.stream()
                .filter(tournament -> tournament.espnId() == id && tournament.draws().contains(draw))
                .findFirst()
                .map(tournament -> new Ref(tournament, draw));
    }

    /**
     * Ids externos de los cuadros que sigue una liga de varios torneos: los de las categorías del alcance y
     * de los circuitos elegidos, en el orden del catálogo.
     */
    public static List<String> externalIds(TennisScope scope, TennisTour tour) {
        return ALL.stream()
                .filter(tournament -> scope.includes(tournament.level()))
                .flatMap(tournament -> tournament.draws().stream()
                        .filter(tour::includes)
                        .map(tournament::externalId))
                .toList();
    }

    /** Sets para ganar un partido de la competición; 2 si no es de tenis o no se conoce. */
    public static int setsToWin(String externalId) {
        return parse(externalId).map(Ref::setsToWin).orElse(2);
    }
}
