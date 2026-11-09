package app.porrapp.sports;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Locale;

/**
 * Calendario de la NFL en ESPN. ESPN numera la temporada regular por semanas (Week 1-18) y los playoffs
 * por rondas (Wild Card, Divisional, Conference, Super Bowl): cada partido va a la semana o ronda que le
 * da ESPN, así que un aplazado no cambia de semana. La pretemporada y la Pro Bowl no se juegan.
 */
public final class NflSchedule {
    private NflSchedule() {}

    /** Id de la NFL en ESPN y en la tabla de competiciones. */
    public static final String EXTERNAL_ID = "nfl";
    /** Ruta de la NFL en la API de ESPN. */
    static final String ESPN_PATH = "football/nfl";

    public static final String WEEK_PREFIX = "Semana ";
    public static final String WILD_CARD = "Ronda de comodines";
    public static final String DIVISIONAL = "Ronda divisional";
    public static final String CONFERENCE = "Final de conferencia";
    public static final String SUPER_BOWL = "Super Bowl";
    /** Rondas de los playoffs, en orden. */
    public static final List<String> PLAYOFF_ROUNDS = List.of(WILD_CARD, DIVISIONAL, CONFERENCE, SUPER_BOWL);

    private static final int PRESEASON = 1;
    private static final int REGULAR_SEASON = 2;
    private static final int POSTSEASON = 3;
    private static final int REGULAR_SEASON_WEEKS = 18;

    public static boolean isNfl(String externalId) {
        return externalId != null && EXTERNAL_ID.equals(externalId.trim().toLowerCase(Locale.ROOT));
    }

    /** Partidos que no se pronostican: pretemporada, Pro Bowl y lo que no es temporada regular ni playoffs. */
    public static boolean isExcluded(JsonNode event) {
        int type = seasonType(event);
        if (type == 0) return false;
        if (type != REGULAR_SEASON && type != POSTSEASON) return true;
        return type == POSTSEASON && isProBowl(event);
    }

    /**
     * Semana o ronda del partido: «Semana 9», «Ronda de comodines»… Null si el evento no lo dice (un
     * resumen sin semana): el partido conserva la que ya tenga.
     */
    public static String roundLabel(JsonNode event) {
        int type = seasonType(event);
        int week = week(event);
        if (week <= 0) return null;
        if (type == REGULAR_SEASON) return week <= REGULAR_SEASON_WEEKS ? WEEK_PREFIX + week : null;
        if (type != POSTSEASON || isProBowl(event)) return null;
        // La Super Bowl es la semana 4 de los playoffs, o la 5 los años en que la Pro Bowl va antes.
        return week >= 4 ? SUPER_BOWL : PLAYOFF_ROUNDS.get(week - 1);
    }

    /** Si la etiqueta es una semana («Semana 9») o una ronda de los playoffs de la NFL. */
    public static boolean isRoundLabel(String round) {
        return round != null && (round.matches(WEEK_PREFIX + "\\d{1,2}") || PLAYOFF_ROUNDS.contains(round));
    }

    /**
     * Pone el prefijo {@code nfl:} a los ids de equipo de ESPN, que se repiten entre deportes (el 10 es un
     * equipo distinto en cada liga de ESPN): así un equipo de la NFL nunca se confunde con el de otro deporte.
     */
    static void namespaceTeamIds(JsonNode node) {
        if (node == null) return;
        if (node.isArray()) {
            for (JsonNode item : node) namespaceTeamIds(item);
            return;
        }
        if (!node.isObject()) return;
        JsonNode team = node.path("team");
        if (team.isObject()) prefixId((ObjectNode) team);
        if (node.has("competitors")) {
            for (JsonNode competitor : node.path("competitors")) {
                if (competitor.isObject()) {
                    prefixId((ObjectNode) competitor);
                    if (competitor.path("team").isObject()) prefixId((ObjectNode) competitor.path("team"));
                }
            }
        }
        if (node.has("competitions")) namespaceTeamIds(node.path("competitions"));
    }

    private static void prefixId(ObjectNode node) {
        String id = node.path("id").asText(null);
        if (id != null && !id.isBlank() && !id.startsWith(EXTERNAL_ID + ":")) node.put("id", EXTERNAL_ID + ":" + id);
    }

    private static int seasonType(JsonNode event) {
        JsonNode type = event.path("season").path("type");
        return type.isObject() ? type.path("type").asInt(type.path("id").asInt(0)) : type.asInt(0);
    }

    private static int week(JsonNode event) {
        JsonNode week = event.path("week");
        return week.isObject() ? week.path("number").asInt(0) : week.asInt(0);
    }

    private static boolean isProBowl(JsonNode event) {
        for (JsonNode competition : event.path("competitions")) {
            for (JsonNode note : competition.path("notes")) {
                if (note.path("headline").asText("").toLowerCase(Locale.ROOT).contains("pro bowl")) return true;
            }
            for (JsonNode competitor : competition.path("competitors")) {
                String abbreviation = competitor.path("team").path("abbreviation").asText("");
                if ("AFC".equals(abbreviation) || "NFC".equals(abbreviation)) return true;
            }
        }
        return false;
    }
}
