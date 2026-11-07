package com.porra.mundial.sports;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.List;

/**
 * Fórmula 1 en la API pública de ESPN.
 * <ul>
 *   <li>Calendario y resultados: {@code site.api.espn.com/.../racing/f1/scoreboard?dates=AAAA}. Cada Gran
 *   Premio trae sus sesiones (FP1…, «Qual», «Race») con hora y, al acabar, los pilotos en orden.</li>
 *   <li>Escuderías y vuelta rápida: la API core ({@code sports.core.api.espn.com}), por sesión.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class EspnFormulaOneClient {

    private static final String SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard";
    private static final String CORE_EVENTS = "https://sports.core.api.espn.com/v2/sports/racing/leagues/f1/events/";

    private final EspnSportsDataProvider espn;

    public boolean isAvailable() {
        return espn.isAvailable();
    }

    /** Grandes Premios de una temporada; vacío si ESPN aún no la ha publicado. */
    public JsonNode seasonEvents(int year) throws Exception {
        return events(espn.fetchEspnJson(SCOREBOARD + "?dates=" + year + "&limit=100"));
    }

    /** Gran Premio en curso o el siguiente (lo que ESPN muestra por defecto). */
    public JsonNode currentEvents() throws Exception {
        return events(espn.fetchEspnJson(SCOREBOARD));
    }

    /** Pilotos de una sesión con su escudería, dorsal y color ({@code items[].vehicle}). */
    public JsonNode sessionCompetitors(String eventId, String sessionId) throws Exception {
        requireIds(eventId, sessionId);
        return espn.fetchEspnJson(CORE_EVENTS + eventId + "/competitions/" + sessionId + "/competitors?limit=60")
                .path("items");
    }

    /**
     * Piloto con la vuelta rápida de una carrera. ESPN solo pone {@code fastestLap} en las estadísticas de
     * quien la hizo, así que se miran en orden de llegada hasta encontrarlo.
     *
     * @return id ESPN del piloto, o null si no lo da
     */
    public String fastestLapAthlete(String eventId, String raceId, List<String> athleteIdsInOrder) throws Exception {
        requireIds(eventId, raceId);
        for (String athleteId : athleteIdsInOrder) {
            if (athleteId == null || !athleteId.matches("\\d{1,20}")) continue;
            JsonNode categories = espn.fetchEspnJson(CORE_EVENTS + eventId + "/competitions/" + raceId
                    + "/competitors/" + athleteId + "/statistics").path("splits").path("categories");
            for (JsonNode category : categories) {
                for (JsonNode stat : category.path("stats")) {
                    if ("fastestLap".equals(stat.path("name").asText()) && !stat.path("displayValue").asText("").isBlank()) {
                        return athleteId;
                    }
                }
            }
        }
        return null;
    }

    private static JsonNode events(JsonNode root) throws IOException {
        JsonNode events = root.path("events");
        if (!events.isArray()) throw new IOException("ESPN devolvió un calendario de F1 sin events");
        return events;
    }

    private static void requireIds(String... ids) {
        for (String id : ids) {
            if (id == null || !id.matches("\\d{1,20}")) throw new IllegalArgumentException("Identificador de ESPN no válido");
        }
    }
}
