package com.porra.mundial.sports;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Torneos de tenis que se pueden jugar en PorrApp: los Grand Slams, los Masters 1000 y las ATP Finals.
 * Cada cuadro individual es una competición: {@code tennis.atp.<id>} el masculino y {@code tennis.wta.<id>}
 * el femenino, con el id del torneo en ESPN (el mismo cada año: Roland Garros 2026 es el evento 172-2026).
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
     * @param espnId id del torneo en ESPN
     * @param name   nombre visible, sin el cuadro
     * @param women  si también tiene cuadro femenino en el mismo evento
     */
    public record Tournament(int espnId, String name, Level level, boolean women) {
        /** Nombre de la competición de un cuadro: con el cuadro solo si el torneo tiene los dos. */
        public String competitionName(Draw draw) {
            return women ? name + " · " + draw.label : name;
        }

        public String externalId(Draw draw) {
            return EXTERNAL_ID_PREFIX + draw.tour + "." + espnId;
        }

        public List<Draw> draws() {
            return women ? List.of(Draw.MEN, Draw.WOMEN) : List.of(Draw.MEN);
        }
    }

    public static final List<Tournament> ALL = List.of(
            new Tournament(154, "Open de Australia", Level.GRAND_SLAM, true),
            new Tournament(172, "Roland Garros", Level.GRAND_SLAM, true),
            new Tournament(188, "Wimbledon", Level.GRAND_SLAM, true),
            new Tournament(189, "US Open", Level.GRAND_SLAM, true),
            new Tournament(411, "Indian Wells", Level.MASTERS_1000, true),
            new Tournament(713, "Miami Open", Level.MASTERS_1000, true),
            new Tournament(42, "Masters de Montecarlo", Level.MASTERS_1000, false),
            new Tournament(413, "Mutua Madrid Open", Level.MASTERS_1000, true),
            new Tournament(414, "Internazionali de Roma", Level.MASTERS_1000, true),
            new Tournament(421, "Abierto de Canadá", Level.MASTERS_1000, true),
            new Tournament(718, "Cincinnati Open", Level.MASTERS_1000, true),
            new Tournament(315, "Masters de Shanghái", Level.MASTERS_1000, false),
            new Tournament(13, "Masters de París", Level.MASTERS_1000, false),
            new Tournament(339, "ATP Finals", Level.FINALS, false));

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

    /** Sets para ganar un partido de la competición; 2 si no es de tenis o no se conoce. */
    public static int setsToWin(String externalId) {
        return parse(externalId).map(Ref::setsToWin).orElse(2);
    }
}
