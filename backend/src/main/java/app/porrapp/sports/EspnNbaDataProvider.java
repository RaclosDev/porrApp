package app.porrapp.sports;

import app.porrapp.model.Competition;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.time.Duration;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * La NBA desde la API pública de ESPN ({@code basketball/nba}), en dos competiciones:
 * <ul>
 *   <li>{@code nba}: el play-in y los playoffs, serie a serie.</li>
 *   <li>{@code nba.regular}: la temporada regular (unos 1.230 partidos, con la Copa NBA dentro), partido a
 *       partido y agrupada en las semanas oficiales de la NBA (de lunes a domingo, hora del Este: la
 *       semana 1 es la del partido inaugural). Cada partido lleva su semana en {@code roundLabel}.</li>
 * </ul>
 * <p>
 * Los playoffs:
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

    private static final String STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3";

    /** Tipos de temporada de ESPN: 2 es la temporada regular, 3 los playoffs y 5 el play-in. */
    static final int REGULAR_SEASON = 2;
    static final int POSTSEASON = 3;
    static final int PLAY_IN = 5;

    /** El play-in empieza a mediados de abril y las Finales acaban en junio. */
    private static final Set<Integer> PLAYOFF_MONTHS = Set.of(4, 5, 6);

    /** La temporada regular va de octubre a abril (la Copa NBA, en noviembre y diciembre). */
    private static final List<Integer> REGULAR_SEASON_MONTHS = List.of(1, 2, 3, 4, 10, 11, 12);

    /** Las semanas de la NBA van de lunes a domingo en la hora del Este de Estados Unidos. */
    static final ZoneId NBA_TIME = ZoneId.of("America/New_York");

    /** Etiqueta de las semanas de la temporada regular: «Semana 3». */
    public static final String WEEK_PREFIX = "Semana ";

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
    private final Map<Integer, Instant> regularSeasonStarts = new ConcurrentHashMap<>();

    /** La competición es la temporada regular de la NBA. */
    public static boolean isRegularSeason(String competitionCode) {
        return competitionCode != null && Competition.NBA_REGULAR_SEASON_EXTERNAL_ID
                .equals(competitionCode.trim().toLowerCase(Locale.ROOT));
    }

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
                && (Competition.NBA_EXTERNAL_ID.equals(competitionCode.trim().toLowerCase(Locale.ROOT))
                || isRegularSeason(competitionCode));
    }

    @Override
    public boolean isAvailable() {
        return espn.isAvailable();
    }

    /**
     * Partidos de play-in y playoffs. {@code dateRange} admite un año (yyyy: abril a junio de ese año), un
     * día (yyyyMMdd; fuera de abril a junio no hay nada que pedir) o nada (los playoffs de este año). En la
     * temporada regular, el año son sus meses de ese año natural (enero a abril y octubre a diciembre).
     */
    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        if (isRegularSeason(competitionSlug)) return fetchRegularSeason(dateRange);
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

    private JsonNode fetchRegularSeason(String dateRange) throws Exception {
        List<String> queries = new ArrayList<>();
        if (dateRange != null && dateRange.matches("\\d{8}")) {
            queries.add(dateRange);
        } else {
            int year = dateRange != null && dateRange.matches("\\d{4}")
                    ? Integer.parseInt(dateRange) : AppTime.day(Instant.now()).getYear();
            REGULAR_SEASON_MONTHS.forEach(month -> queries.add(String.format("%d%02d", year, month)));
        }
        ArrayNode result = objectMapper.createArrayNode();
        for (String dates : queries) {
            JsonNode events = espn.fetchEspnJson(SCOREBOARD + "?dates=" + dates + "&limit=1000").path("events");
            if (!events.isArray()) throw new IOException("ESPN devolvió un marcador de la NBA sin events");
            for (JsonNode event : events) {
                if (event.path("season").path("type").asInt(0) != REGULAR_SEASON) continue;
                JsonNode adapted = adaptRegularSeason(event, regularSeasonStart(event.path("season").path("year").asInt(0)));
                if (adapted != null) result.add(adapted);
            }
        }
        return result;
    }

    /**
     * Primer día de la temporada regular en ESPN ({@code season.year} es el año en que acaba: 2027 para la
     * 2026-27). Se guarda, porque no cambia en toda la temporada. Sin él no se sabe la semana de cada partido.
     */
    private Instant regularSeasonStart(int seasonYear) throws Exception {
        if (seasonYear <= 0) throw new IOException("Partido de la NBA sin temporada");
        Instant cached = regularSeasonStarts.get(seasonYear);
        if (cached != null) return cached;
        Instant start = parse(espn.fetchEspnJson(String.format(SEASON_TYPE, seasonYear, REGULAR_SEASON))
                .path("startDate").asText(null));
        if (start == null) throw new IOException("ESPN no da el inicio de la temporada " + seasonYear + " de la NBA");
        regularSeasonStarts.put(seasonYear, start);
        return start;
    }

    /**
     * Semana oficial de la NBA de un partido: de lunes a domingo en la hora del Este, y la 1 es la del
     * partido inaugural (que suele ser martes). 0 si el partido es de antes del inicio.
     */
    static int week(Instant game, Instant seasonStart) {
        LocalDate first = seasonStart.atZone(NBA_TIME).toLocalDate()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        long days = ChronoUnit.DAYS.between(first, game.atZone(NBA_TIME).toLocalDate());
        return days < 0 ? 0 : (int) (days / 7) + 1;
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
     * (para ver cómo acabaron) y los que vienen. La temporada regular, de su primer a su último día.
     */
    @Override
    public SeasonWindow fetchSeasonWindow(String competitionSlug) throws Exception {
        if (isRegularSeason(competitionSlug)) {
            int year = espn.fetchEspnJson(SCOREBOARD).path("leagues").path(0).path("season").path("year").asInt(0);
            if (year == 0) return null;
            JsonNode type = espn.fetchEspnJson(String.format(SEASON_TYPE, year, REGULAR_SEASON));
            String start = type.path("startDate").asText(null);
            String end = type.path("endDate").asText(null);
            return start == null || end == null ? null : new SeasonWindow(start, end);
        }
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

    /**
     * Clasificación de la temporada regular en ESPN: las dos conferencias con sus tres divisiones, y en cada
     * equipo su puesto en la conferencia ({@code playoffSeed}), su balance y los partidos que lleva por detrás.
     */
    public JsonNode fetchStandings() throws Exception {
        return espn.fetchEspnJson(STANDINGS);
    }

    /**
     * Partido de temporada regular en el formato de fútbol, con su semana en {@code roundLabel} («Semana 3»);
     * null si le falta un rival (un cruce de la Copa NBA sin decidir) o es de antes del inicio.
     */
    JsonNode adaptRegularSeason(JsonNode event, Instant seasonStart) {
        JsonNode competition = event.path("competitions").path(0);
        JsonNode competitors = competition.path("competitors");
        if (!competitors.isArray() || competitors.size() != 2) return null;
        for (JsonNode competitor : competitors) {
            if (conference(competitor.path("team").path("id").asText(null)) == null) return null;
        }
        Instant date = parse(competition.path("date").asText(event.path("date").asText(null)));
        int week = date == null ? 0 : week(date, seasonStart);
        if (week <= 0) return null;

        ObjectNode adaptedCompetition = objectMapper.createObjectNode();
        adaptedCompetition.put("id", competition.path("id").asText(event.path("id").asText()));
        adaptedCompetition.put("date", competition.path("date").asText(event.path("date").asText()));
        adaptedCompetition.set("status", competition.path("status"));
        adaptedCompetition.set("notes", competition.path("notes"));
        ArrayNode adaptedCompetitors = adaptedCompetition.putArray("competitors");
        for (JsonNode competitor : competitors) {
            JsonNode team = competitor.path("team");
            ObjectNode node = adaptedCompetitors.addObject();
            node.put("homeAway", competitor.path("homeAway").asText());
            if (competitor.hasNonNull("score")) node.put("score", competitor.path("score").asText());
            ObjectNode adaptedTeam = node.putObject("team");
            adaptedTeam.put("id", TEAM_PREFIX + team.path("id").asText());
            adaptedTeam.put("displayName", team.path("displayName").asText());
            if (team.hasNonNull("logo")) adaptedTeam.put("logo", team.path("logo").asText());
        }

        ObjectNode adapted = objectMapper.createObjectNode();
        adapted.put("id", event.path("id").asText());
        adapted.put("date", event.path("date").asText());
        adapted.put("name", event.path("name").asText(""));
        adapted.put("roundLabel", WEEK_PREFIX + week);
        ObjectNode season = adapted.putObject("season");
        season.put("year", event.path("season").path("year").asInt());
        season.put("type", REGULAR_SEASON);
        season.put("slug", "regular-season");
        adapted.putArray("competitions").add(adaptedCompetition);
        return adapted;
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
