package com.porra.mundial.sports;

import com.porra.mundial.model.Competition;
import com.porra.mundial.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Playoffs de la NBA desde la API pública de ESPN ({@code basketball/nba}). Solo se guardan el play-in y
 * los playoffs: la temporada regular (1.230 partidos) no se pronostica.
 * <p>
 * Cada partido se traduce al formato de evento de fútbol que entiende {@code MatchEventProcessor}:
 * <ul>
 *   <li>{@code season.slug} lleva la ronda: «play-in», «round-of-16» (primera ronda), «quarterfinals»
 *       (semifinales de conferencia), «semifinals» (finales de conferencia) y «final» (Finales).</li>
 *   <li>Solo el partido que cierra la serie (la cuarta victoria) marca {@code advance}: así el ganador del
 *       cruce es el de la serie, no el de cada partido.</li>
 *   <li>Los ids de equipo llevan el prefijo {@code nba-}: los de ESPN se repiten entre deportes.</li>
 *   <li>Los partidos con un rival aún por decidir (TBD) no se guardan: la serie aparece entera cuando se
 *       conocen los dos equipos, y el orden de los cruces no cambia.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EspnNbaDataProvider implements SportsDataProvider {

    static final String SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
    private static final String TEAMS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";
    private static final String SEASON_TYPE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/%d/types/%d";

    /** Tipos de temporada de ESPN: 3 son los playoffs y 5 el play-in. */
    static final int POSTSEASON = 3;
    static final int PLAY_IN = 5;

    /** El play-in empieza a mediados de abril y las Finales acaban en junio. */
    private static final Set<Integer> PLAYOFF_MONTHS = Set.of(4, 5, 6);

    /** Prefijo de los ids de equipo de la NBA. */
    public static final String TEAM_PREFIX = "nba-";

    /** Conferencia de cada franquicia (id de ESPN). Estable desde 2004. */
    private static final Set<String> EAST = Set.of("1", "2", "4", "5", "8", "11", "14", "15", "17", "18", "19",
            "20", "27", "28", "30");
    private static final Set<String> WEST = Set.of("3", "6", "7", "9", "10", "12", "13", "16", "21", "22", "23",
            "24", "25", "26", "29");

    private static final Duration CALENDAR_TTL = Duration.ofHours(12);

    private final EspnSportsDataProvider espn;
    private final ObjectMapper objectMapper;

    private volatile Instant cachedStart;
    private volatile Instant cachedStartAt;

    /** «E», «W» o null según la conferencia del equipo (id externo con o sin prefijo). */
    public static String conference(String teamExternalId) {
        if (teamExternalId == null) return null;
        String id = teamExternalId.startsWith(TEAM_PREFIX) ? teamExternalId.substring(TEAM_PREFIX.length()) : teamExternalId;
        if (EAST.contains(id)) return "E";
        if (WEST.contains(id)) return "W";
        return null;
    }

    @Override
    public String getProviderName() {
        return "ESPN NBA";
    }

    @Override
    public boolean supports(String competitionCode) {
        return competitionCode != null
                && Competition.NBA_EXTERNAL_ID.equals(competitionCode.trim().toLowerCase(Locale.ROOT));
    }

    @Override
    public boolean isAvailable() {
        return espn.isAvailable();
    }

    /**
     * Partidos de play-in y playoffs. {@code dateRange} admite un año (yyyy: abril a junio de ese año), un
     * día (yyyyMMdd; fuera de abril a junio no hay nada que pedir) o nada (los playoffs de este año).
     */
    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        List<String> queries = new ArrayList<>();
        if (dateRange != null && dateRange.matches("\\d{8}")) {
            int month = Integer.parseInt(dateRange.substring(4, 6));
            if (PLAYOFF_MONTHS.contains(month)) queries.add(dateRange);
        } else {
            int year = dateRange != null && dateRange.matches("\\d{4}")
                    ? Integer.parseInt(dateRange) : AppTime.day(Instant.now()).getYear();
            PLAYOFF_MONTHS.stream().sorted().forEach(month -> queries.add(String.format("%d%02d", year, month)));
        }
        ArrayNode result = objectMapper.createArrayNode();
        for (String dates : queries) {
            JsonNode events = espn.fetchEspnJson(SCOREBOARD + "?dates=" + dates + "&limit=1000").path("events");
            if (!events.isArray()) throw new IOException("ESPN devolvió un marcador de la NBA sin events");
            for (JsonNode event : events) {
                JsonNode adapted = adapt(event);
                if (adapted != null) result.add(adapted);
            }
        }
        return result;
    }

    /** Las 30 franquicias, con el id prefijado y sin abreviatura (las de la MLS coinciden). */
    @Override
    public JsonNode fetchTeams(String competitionSlug) throws Exception {
        ArrayNode result = objectMapper.createArrayNode();
        for (JsonNode item : espn.fetchEspnJson(TEAMS).path("sports").path(0).path("leagues").path(0).path("teams")) {
            JsonNode team = item.path("team");
            String id = team.path("id").asText(null);
            if (conference(id) == null) continue;
            ObjectNode node = objectMapper.createObjectNode();
            node.put("id", TEAM_PREFIX + id);
            node.put("displayName", team.path("displayName").asText());
            String logo = team.path("logos").path(0).path("href").asText(null);
            if (logo != null) node.put("logo", logo);
            result.add(node);
        }
        return result;
    }

    /**
     * Desde el 1 de abril del año anterior al final de la temporada en curso: entran los últimos playoffs
     * (para ver cómo acabaron) y los que vienen.
     */
    @Override
    public SeasonWindow fetchSeasonWindow(String competitionSlug) throws Exception {
        JsonNode season = espn.fetchEspnJson(SCOREBOARD).path("leagues").path(0).path("season");
        int year = season.path("year").asInt(0);
        String end = season.path("endDate").asText(null);
        if (year == 0 || end == null) return null;
        return new SeasonWindow((year - 1) + "-04-01T00:00Z", end);
    }

    @Override
    public List<String> fetchSeasonCalendarDates(String competitionSlug) {
        return List.of();
    }

    /**
     * Cuándo empiezan los próximos playoffs (el play-in) de la temporada en curso, o null si ya han
     * empezado o ESPN no lo dice. Se guarda unas horas: ESPN lo publica con la temporada.
     */
    public Instant nextPlayoffsStart() {
        Instant now = Instant.now();
        if (cachedStartAt == null || now.isAfter(cachedStartAt.plus(CALENDAR_TTL))) {
            try {
                cachedStart = fetchPlayoffsStart();
            } catch (Exception e) {
                log.warn("No se pudo leer cuándo empiezan los playoffs de la NBA: {}", e.getMessage());
                cachedStart = null;
            }
            cachedStartAt = now;
        }
        return cachedStart != null && cachedStart.isAfter(now) ? cachedStart : null;
    }

    private Instant fetchPlayoffsStart() throws Exception {
        int year = espn.fetchEspnJson(SCOREBOARD).path("leagues").path(0).path("season").path("year").asInt(0);
        if (year == 0) return null;
        Instant start = null;
        for (int type : new int[]{PLAY_IN, POSTSEASON}) {
            String date = espn.fetchEspnJson(String.format(SEASON_TYPE, year, type)).path("startDate").asText(null);
            Instant parsed = parse(date);
            if (parsed != null && (start == null || parsed.isBefore(start))) start = parsed;
        }
        return start;
    }

    /** Evento de play-in o playoffs en el formato de fútbol; null si es de temporada regular o sin rivales. */
    JsonNode adapt(JsonNode event) {
        int type = event.path("season").path("type").asInt(0);
        if (type != POSTSEASON && type != PLAY_IN) return null;
        JsonNode competition = event.path("competitions").path(0);
        String round = type == PLAY_IN ? "play-in" : roundSlug(competition);
        if (round == null) return null;
        JsonNode competitors = competition.path("competitors");
        if (!competitors.isArray() || competitors.size() != 2) return null;
        for (JsonNode competitor : competitors) {
            if (conference(competitor.path("team").path("id").asText(null)) == null) return null;
        }

        JsonNode series = competition.path("series");
        boolean seriesOver = series.path("completed").asBoolean(false);
        Map<String, Integer> wins = new HashMap<>();
        for (JsonNode node : series.path("competitors")) wins.put(node.path("id").asText(""), node.path("wins").asInt(0));
        int needed = series.path("totalCompetitions").asInt(1) / 2 + 1;
        boolean finished = competition.path("status").path("type").path("completed").asBoolean(false);

        ObjectNode adaptedCompetition = objectMapper.createObjectNode();
        adaptedCompetition.put("id", competition.path("id").asText(event.path("id").asText()));
        adaptedCompetition.put("date", competition.path("date").asText(event.path("date").asText()));
        adaptedCompetition.set("status", competition.path("status"));
        adaptedCompetition.set("notes", competition.path("notes"));
        ArrayNode adaptedCompetitors = adaptedCompetition.putArray("competitors");
        for (JsonNode competitor : competitors) {
            JsonNode team = competitor.path("team");
            String id = team.path("id").asText();
            ObjectNode node = adaptedCompetitors.addObject();
            node.put("homeAway", competitor.path("homeAway").asText());
            if (competitor.hasNonNull("score")) node.put("score", competitor.path("score").asText());
            boolean winsGame = finished && competitor.path("winner").asBoolean(false);
            // Gana el cruce quien gana el partido único del play-in o el que le da la serie.
            boolean advances = type == PLAY_IN ? winsGame
                    : seriesOver && winsGame && wins.getOrDefault(id, 0) >= needed;
            node.put("advance", advances);
            ObjectNode adaptedTeam = node.putObject("team");
            adaptedTeam.put("id", TEAM_PREFIX + id);
            adaptedTeam.put("displayName", team.path("displayName").asText());
            if (team.hasNonNull("logo")) adaptedTeam.put("logo", team.path("logo").asText());
        }

        ObjectNode adapted = objectMapper.createObjectNode();
        adapted.put("id", event.path("id").asText());
        adapted.put("date", event.path("date").asText());
        adapted.put("name", event.path("name").asText(""));
        ObjectNode season = adapted.putObject("season");
        season.put("year", event.path("season").path("year").asInt());
        season.put("type", type);
        season.put("slug", round);
        adapted.putArray("competitions").add(adaptedCompetition);
        return adapted;
    }

    /** Ronda del partido de playoffs: ESPN la da en el tipo de competición y en la nota («West Finals»…). */
    static String roundSlug(JsonNode competition) {
        String type = competition.path("type").path("abbreviation").asText("").toUpperCase(Locale.ROOT);
        switch (type) {
            case "RD16": return "round-of-16";
            case "QTR": return "quarterfinals";
            case "SEMI": return "semifinals";
            case "FINAL": return "final";
            default: break;
        }
        String headline = competition.path("notes").path(0).path("headline").asText("").toLowerCase(Locale.ROOT);
        if (headline.contains("1st round") || headline.contains("first round")) return "round-of-16";
        if (headline.contains("semifinal")) return "quarterfinals";
        if (headline.startsWith("nba finals")) return "final";
        if (headline.contains("finals")) return "semifinals";
        return null;
    }

    private static Instant parse(String date) {
        try {
            return date == null ? null : ZonedDateTime.parse(date).toInstant();
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }
}
