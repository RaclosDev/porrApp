package com.porra.mundial.service.sync;

import com.porra.mundial.model.MatchStatusNormalized;
import tools.jackson.databind.JsonNode;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Texto del reloj de un partido ({@code matches.display_clock}) a partir del estado de ESPN.
 * <ul>
 *   <li>En juego, en la NBA y la NFL lleva el cuarto («3.er cuarto · 5:00», «Prórroga · 2:11»): el
 *       reloj solo («5:00») no dice en qué parte va el partido. En el resto, el de ESPN («67'»).</li>
 *   <li>Terminado, guarda cómo acabó más allá del marcador, para enseñarlo junto al resultado:
 *       {@code OT} o {@code 2OT} (prórrogas de la NBA y la NFL), {@code AET} (fútbol tras la prórroga) o
 *       {@code PEN 4-2} (penaltis, local-visitante). Sin nada de eso, el reloj de ESPN.</li>
 * </ul>
 */
final class MatchClock {
    private MatchClock() {}

    /** Códigos que se guardan al terminar; el frontend los traduce. */
    static final String AFTER_EXTRA_TIME = "AET";
    static final String PENALTIES_PREFIX = "PEN ";

    private static final Pattern OVERTIME = Pattern.compile("(?i)^final/(\\d*)OT$");
    private static final int REGULATION_QUARTERS = 4;

    /**
     * @param competition nodo {@code competitions[0]} del evento de ESPN
     * @param quarters    si el deporte se juega por cuartos (NBA y NFL)
     */
    static String of(JsonNode competition, MatchStatusNormalized normalized, boolean quarters) {
        JsonNode status = competition.path("status");
        String clock = status.path("displayClock").asText(null);
        if (normalized == MatchStatusNormalized.FINISHED) {
            String finish = finish(competition, status);
            return finish != null ? finish : clock;
        }
        if (quarters && normalized != null && normalized.isLive()) {
            int period = status.path("period").asInt(0);
            if (period <= 0) return clock;
            if (normalized == MatchStatusNormalized.PAUSED) return "Descanso";
            String part = period(period);
            return clock == null || clock.isBlank() ? part : part + " · " + clock;
        }
        return clock;
    }

    private static String finish(JsonNode competition, JsonNode status) {
        JsonNode type = status.path("type");
        String name = type.path("name").asText("").toUpperCase(Locale.ROOT);
        Matcher overtime = OVERTIME.matcher(type.path("shortDetail").asText("").trim());
        if (overtime.matches()) return overtime.group(1) + "OT";
        if (name.endsWith("_PEN")) {
            Integer home = shootout(competition, "home");
            Integer away = shootout(competition, "away");
            return home != null && away != null ? PENALTIES_PREFIX + home + "-" + away : AFTER_EXTRA_TIME;
        }
        if (name.endsWith("_AET")) return AFTER_EXTRA_TIME;
        return null;
    }

    private static Integer shootout(JsonNode competition, String homeAway) {
        for (JsonNode competitor : competition.path("competitors")) {
            if (homeAway.equals(competitor.path("homeAway").asText())) {
                JsonNode score = competitor.path("shootoutScore");
                return score.isNumber() || score.isTextual() && score.asText().matches("\\d+") ? score.asInt() : null;
            }
        }
        return null;
    }

    /** «1.er cuarto»… «4.º cuarto», «Prórroga» y «2.ª prórroga»… */
    static String period(int period) {
        if (period <= REGULATION_QUARTERS) {
            return period + (period == 1 || period == 3 ? ".er" : ".º") + " cuarto";
        }
        int overtime = period - REGULATION_QUARTERS;
        return overtime == 1 ? "Prórroga" : overtime + ".ª prórroga";
    }
}
