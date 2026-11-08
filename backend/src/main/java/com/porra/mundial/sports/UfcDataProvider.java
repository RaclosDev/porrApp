package com.porra.mundial.sports;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Veladas de la UFC desde la API pública de ESPN.
 * <p>
 * El calendario sale del marcador ({@code scoreboard}) y la cartelera de cada velada de {@code fightcenter},
 * que es lo único que da el bloque (estelar o preliminares), el orden y cómo acabó cada pelea (método y
 * asalto). Cada pelea se traduce a un evento de ESPN con los luchadores como equipos, para que
 * {@code MatchEventProcessor} la guarde como un partido más; sus datos de pelea van en el nodo {@code ufc}.
 * <p>
 * ESPN quita de la cartelera las peleas que se caen: no llegan con estado «cancelada». Por eso cada pelea
 * lleva también la cartelera entera ({@code ufc.card}), con la que se detectan las que ya no están.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@Slf4j
public class UfcDataProvider implements SportsDataProvider {

    public static final String CIRCUIT_BREAKER = "ufcApi";
    public static final String COMPETITION_ID = "mma.ufc";
    /** Prefijo del id externo de las peleas, para no chocar con los ids de partidos de ESPN. */
    public static final String FIGHT_ID_PREFIX = "ufc-";
    /** Prefijo del id externo de los luchadores, que se guardan como equipos. */
    public static final String FIGHTER_ID_PREFIX = "ufc-a";

    private static final String SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
    private static final String FIGHTCENTER_URL =
            "https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/%s?region=us&lang=en";
    private static final ZoneId SPAIN_ZONE = ZoneId.of("Europe/Madrid");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    /** Solo veladas de la UFC: «UFC 334…», «UFC Fight Night…», «Noche UFC…»; no el Contender Series. */
    private static final Pattern UFC_EVENT = Pattern.compile("^(UFC|Noche UFC)\\b.*", Pattern.CASE_INSENSITIVE);
    private static final Pattern EVENT_ID = Pattern.compile("/events/(\\d+)");
    private static final Pattern NUMERIC_ID = Pattern.compile("\\d{1,15}");
    /** Hasta tres tarjetas como «30-27 | 29-28 | 30-27» (caben de sobra en 40 caracteres). */
    private static final Pattern JUDGES_SCORES = Pattern.compile("\\d{1,2}-\\d{1,2}( \\| \\d{1,2}-\\d{1,2}){0,2}");
    /** Las peleas de una velada se reparten en bloques que empiezan horas antes del inicio del calendario. */
    private static final Duration EVENT_LEAD = Duration.ofHours(6);
    /** Una velada en curso o por llegar cambia a menudo; una terminada hace días, ya no. */
    private static final Duration LIVE_TTL = Duration.ofSeconds(60);
    private static final Duration SETTLED_TTL = Duration.ofHours(12);
    private static final Duration SETTLED_AFTER = Duration.ofDays(2);
    private static final Duration CALENDAR_TTL = Duration.ofMinutes(10);
    private static final int MAX_EVENTS_PER_YEAR = 120;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final Map<String, CachedCalendar> calendars = new ConcurrentHashMap<>();
    private final Map<String, CachedCard> cards = new ConcurrentHashMap<>();

    /** Velada del calendario. */
    record CalendarEvent(String id, String name, Instant start, Instant end) {}

    private record CachedCalendar(List<CalendarEvent> events, Map<String, Integer> rounds, Instant fetchedAt) {}

    private record CachedCard(List<JsonNode> fights, Instant fetchedAt, boolean settled) {}

    public UfcDataProvider(HttpClient httpClient, ObjectMapper objectMapper, CircuitBreakerRegistry circuitBreakerRegistry) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
    }

    public static boolean isUfcCompetition(String externalId) {
        return externalId != null && COMPETITION_ID.equals(externalId.trim().toLowerCase(Locale.ROOT));
    }

    /** Id externo de un luchador guardado como equipo. */
    public static boolean isFighterId(String externalId) {
        return externalId != null && externalId.startsWith(FIGHTER_ID_PREFIX);
    }

    @Override
    public String getProviderName() {
        return "ESPN UFC";
    }

    @Override
    public boolean supports(String competitionCode) {
        return isUfcCompetition(competitionCode);
    }

    @Override
    public boolean isAvailable() {
        CircuitBreaker.State state = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER).getState();
        return state != CircuitBreaker.State.OPEN && state != CircuitBreaker.State.FORCED_OPEN;
    }

    /**
     * Peleas de las veladas de un año ({@code yyyy}), de las que tocan un día ({@code yyyyMMdd}, en hora
     * peninsular) o, sin rango, del año en curso.
     */
    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        ArrayNode result = objectMapper.createArrayNode();
        String range = dateRange == null ? "" : dateRange.trim();
        LocalDate day = null;
        int year;
        if (range.length() == 8 && range.chars().allMatch(Character::isDigit)) {
            day = LocalDate.parse(range, DAY);
            year = day.getYear();
        } else if (range.length() == 4 && range.chars().allMatch(Character::isDigit)) {
            year = Integer.parseInt(range);
        } else {
            year = LocalDate.now(SPAIN_ZONE).getYear();
        }
        CachedCalendar calendar = calendar(year);
        // Una velada de fin de año puede acabar ya en enero (hora peninsular): también se mira el año anterior.
        List<CalendarEvent> events = new ArrayList<>(calendar.events());
        Map<String, Integer> rounds = new HashMap<>(calendar.rounds());
        if (day != null && day.getDayOfYear() == 1) {
            CachedCalendar previous = calendar(year - 1);
            events.addAll(previous.events());
            rounds.putAll(previous.rounds());
        }
        for (CalendarEvent event : events) {
            if (day != null && !touches(event, day)) continue;
            card(event, rounds).forEach(result::add);
        }
        return result;
    }

    /** Los luchadores se dan de alta al leer cada pelea: el catálogo de equipos va vacío. */
    @Override
    public JsonNode fetchTeams(String competitionSlug) {
        return objectMapper.createArrayNode();
    }

    /** La temporada es el año natural: de la primera a la última velada del calendario. */
    @Override
    public SeasonWindow fetchSeasonWindow(String competitionSlug) throws Exception {
        List<CalendarEvent> events = calendar(LocalDate.now(SPAIN_ZONE).getYear()).events();
        if (events.isEmpty()) return null;
        Instant start = events.stream().map(CalendarEvent::start).min(Instant::compareTo).orElseThrow();
        Instant end = events.stream().map(CalendarEvent::end).max(Instant::compareTo).orElseThrow();
        return new SeasonWindow(start.minus(EVENT_LEAD).toString(), end.toString());
    }

    @Override
    public List<String> fetchSeasonCalendarDates(String competitionSlug) throws Exception {
        return calendar(LocalDate.now(SPAIN_ZONE).getYear()).events().stream()
                .map(event -> event.start().toString())
                .toList();
    }

    static boolean touches(CalendarEvent event, LocalDate day) {
        Instant dayStart = day.atStartOfDay(SPAIN_ZONE).toInstant();
        Instant dayEnd = day.plusDays(1).atStartOfDay(SPAIN_ZONE).toInstant();
        return event.start().minus(EVENT_LEAD).isBefore(dayEnd) && event.end().isAfter(dayStart);
    }

    private CachedCalendar calendar(int year) throws Exception {
        String key = String.valueOf(year);
        CachedCalendar cached = calendars.get(key);
        if (cached != null && Instant.now().isBefore(cached.fetchedAt().plus(CALENDAR_TTL))) return cached;
        JsonNode scoreboard = request(SCOREBOARD_URL + "?dates=" + year + "0101-" + year + "1231&limit=1000");
        List<CalendarEvent> events = parseCalendar(scoreboard.path("leagues").path(0).path("calendar"));
        CachedCalendar fresh = new CachedCalendar(events, scheduledRounds(scoreboard), Instant.now());
        calendars.put(key, fresh);
        return fresh;
    }

    /** Veladas de la UFC del calendario de ESPN, sin el Contender Series ni otras ligas. */
    static List<CalendarEvent> parseCalendar(JsonNode calendar) throws IOException {
        if (!calendar.isArray()) throw new IOException("ESPN no devolvió el calendario de la UFC");
        List<CalendarEvent> events = new ArrayList<>();
        for (JsonNode item : calendar) {
            String name = item.path("label").asText("").trim();
            Matcher id = EVENT_ID.matcher(item.path("event").path("$ref").asText(""));
            Instant start = instant(item.path("startDate").asText(null));
            Instant end = instant(item.path("endDate").asText(null));
            if (!UFC_EVENT.matcher(name).matches() || !id.find() || start == null) continue;
            events.add(new CalendarEvent(id.group(1), name, start, end == null || end.isBefore(start) ? start : end));
            if (events.size() > MAX_EVENTS_PER_YEAR) throw new IOException("Calendario de la UFC demasiado grande");
        }
        return events;
    }

    /** Asaltos previstos de cada pelea del marcador ({@code format.regulation.periods}). */
    private static Map<String, Integer> scheduledRounds(JsonNode scoreboard) {
        Map<String, Integer> rounds = new HashMap<>();
        for (JsonNode event : scoreboard.path("events")) {
            for (JsonNode competition : event.path("competitions")) {
                int periods = competition.path("format").path("regulation").path("periods").asInt(0);
                String id = competition.path("id").asText(null);
                if (id != null && periods > 0) rounds.put(id, periods);
            }
        }
        return rounds;
    }

    private List<JsonNode> card(CalendarEvent event, Map<String, Integer> rounds) throws Exception {
        CachedCard cached = cards.get(event.id());
        Instant now = Instant.now();
        if (cached != null && now.isBefore(cached.fetchedAt().plus(cached.settled() ? SETTLED_TTL : LIVE_TTL))) {
            return cached.fights();
        }
        if (!NUMERIC_ID.matcher(event.id()).matches()) throw new IOException("Id de velada no válido");
        JsonNode fightcenter = request(String.format(FIGHTCENTER_URL, event.id()));
        List<JsonNode> fights = adaptCard(event, fightcenter.path("cards"), rounds);
        boolean settled = event.end().plus(SETTLED_AFTER).isBefore(now);
        cards.put(event.id(), new CachedCard(fights, now, settled));
        return fights;
    }

    /** Peleas de la cartelera de una velada como eventos de ESPN. */
    List<JsonNode> adaptCard(CalendarEvent event, JsonNode cards, Map<String, Integer> rounds) {
        List<JsonNode> bouts = new ArrayList<>();
        ArrayNode card = objectMapper.createArrayNode();
        for (Map.Entry<String, JsonNode> segment : cards.properties()) {
            for (JsonNode bout : segment.getValue().path("competitions")) {
                JsonNode home = corner(bout, 1);
                JsonNode away = corner(bout, 2);
                String id = bout.path("id").asText("");
                if (!NUMERIC_ID.matcher(id).matches() || home == null || away == null) continue;
                bouts.add(bout);
                card.addObject()
                        .put("id", FIGHT_ID_PREFIX + id)
                        .put("home", fighterId(home))
                        .put("away", fighterId(away))
                        .put("homeName", fighterName(home))
                        .put("awayName", fighterName(away));
            }
        }
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode bout : bouts) {
            JsonNode adapted = adapt(event, bout, card, rounds);
            if (adapted != null) result.add(adapted);
        }
        return result;
    }

    private JsonNode adapt(CalendarEvent event, JsonNode bout, ArrayNode card, Map<String, Integer> rounds) {
        String id = bout.path("id").asText();
        JsonNode home = corner(bout, 1);
        JsonNode away = corner(bout, 2);
        if (fighterId(home) == null || fighterId(away) == null) return null;
        JsonNode status = bout.path("status");
        JsonNode type = status.path("type");
        boolean completed = type.path("completed").asBoolean(false);
        boolean live = "in".equalsIgnoreCase(type.path("state").asText(""));
        String resultName = status.path("result").path("name").asText(null);

        ObjectNode statusType = objectMapper.createObjectNode()
                .put("name", type.path("name").asText(""))
                .put("state", type.path("state").asText("pre"))
                .put("completed", completed);
        ObjectNode adaptedStatus = objectMapper.createObjectNode();
        adaptedStatus.set("type", statusType);
        if (live) adaptedStatus.put("displayClock", type.path("detail").asText(null));

        ArrayNode competitors = objectMapper.createArrayNode();
        boolean homeWins = home.path("winner").asBoolean(false);
        boolean awayWins = away.path("winner").asBoolean(false);
        for (JsonNode fighter : new JsonNode[]{home, away}) {
            ObjectNode competitor = competitors.addObject().put("homeAway", fighter == home ? "home" : "away");
            JsonNode athlete = fighter.path("athlete");
            ObjectNode team = competitor.putObject("team")
                    .put("id", fighterId(fighter))
                    .put("displayName", fighterName(fighter));
            String headshot = athlete.path("headshot").path("href").asText(null);
            if (headshot != null) team.put("logo", headshot);
            competitor.put("winner", fighter.path("winner").asBoolean(false));
            // El «marcador» de una pelea es quién ganó: 1-0, o 0-0 si no hay ganador (empate, sin resultado).
            if (completed) competitor.put("score", (fighter == home ? homeWins : awayWins) ? "1" : "0");
        }

        ObjectNode competition = objectMapper.createObjectNode().put("id", FIGHT_ID_PREFIX + id);
        competition.set("status", adaptedStatus);
        competition.set("competitors", competitors);

        ObjectNode ufc = objectMapper.createObjectNode()
                .put("eventId", event.id())
                .put("eventName", event.name())
                .put("segment", segment(bout.path("cardSegment").path("name").asText("")))
                .put("weightClass", bout.path("type").path("text").asText(null))
                .put("homeRecord", home.path("displayRecord").asText(null))
                .put("awayRecord", away.path("displayRecord").asText(null));
        if (bout.path("matchNumber").isNumber()) ufc.put("order", bout.path("matchNumber").asInt());
        String title = title(bout);
        if (title != null) ufc.put("title", title);
        ufc.put("rounds", rounds.getOrDefault(id, defaultRounds(bout)));
        if (completed) {
            ufc.put("method", resultName);
            ufc.put("methodDetail", detail(status.path("result")));
            if (status.path("period").asInt(0) > 0) ufc.put("round", status.path("period").asInt());
            String clock = status.path("displayClock").asText(null);
            if (clock != null && !"-".equals(clock)) ufc.put("clock", clock);
            String judges = judgesScores(bout);
            if (judges != null) ufc.put("judgesScores", judges);
        }
        ufc.set("card", card);

        ObjectNode adapted = objectMapper.createObjectNode()
                .put("id", FIGHT_ID_PREFIX + id)
                .put("date", bout.path("date").asText(event.start().toString()))
                .put("name", fighterName(home) + " vs. " + fighterName(away));
        adapted.putArray("competitions").add(competition);
        adapted.set("ufc", ufc);
        return adapted;
    }

    /** La estelar y los combates por el título son a cinco asaltos; el resto, a tres. */
    static int defaultRounds(JsonNode bout) {
        String note = bout.path("note").asText("").toLowerCase(Locale.ROOT);
        return bout.path("matchNumber").asInt(0) == 1 || note.contains("title fight") ? 5 : 3;
    }

    /**
     * Título en juego: el de {@code types} («UFC Heavyweight Title») o, si solo lo dice la nota
     * («Heavyweight - Main Event - Title Fight»), «Title Fight». Null si no hay título.
     */
    static String title(JsonNode bout) {
        for (JsonNode type : bout.path("types")) {
            String text = type.path("text").asText("").trim();
            if (text.toLowerCase(Locale.ROOT).contains("title")) return clip(text, 60);
        }
        return bout.path("note").asText("").toLowerCase(Locale.ROOT).contains("title fight") ? "Title Fight" : null;
    }

    /** Tarjetas de los jueces («30-27 | 29-28 | 30-27»), solo si tienen esa forma. */
    static String judgesScores(JsonNode bout) {
        String scores = bout.path("judgesScores").asText("").trim();
        return JUDGES_SCORES.matcher(scores).matches() ? scores : null;
    }

    private static String clip(String text, int max) {
        return text.length() > max ? text.substring(0, max) : text;
    }

    /** «KO/TKO - Punches», «Decision - Split», «Submission - Triangle Choke»… */
    private static String detail(JsonNode result) {
        String name = result.path("displayName").asText("");
        String description = result.path("displayDescription").asText(result.path("description").asText(""));
        String text = description.isBlank() || name.contains(description) ? name : name + " - " + description;
        return text.isBlank() ? null : text.length() > 100 ? text.substring(0, 100) : text;
    }

    static String segment(String espnSegment) {
        return switch (espnSegment == null ? "" : espnSegment) {
            case "main" -> "MAIN";
            case "prelims2" -> "EARLY_PRELIMS";
            default -> "PRELIMS";
        };
    }

    /** Luchador de la esquina {@code order} (1 roja, 2 azul); el primero o el segundo si no la indica. */
    private static JsonNode corner(JsonNode bout, int order) {
        JsonNode competitors = bout.path("competitors");
        if (!competitors.isArray() || competitors.size() != 2) return null;
        for (JsonNode competitor : competitors) {
            if (competitor.path("order").asInt(0) == order) return competitor;
        }
        return competitors.get(order - 1);
    }

    private static String fighterId(JsonNode fighter) {
        String id = fighter.path("athlete").path("id").asText(fighter.path("id").asText(""));
        return NUMERIC_ID.matcher(id).matches() ? FIGHTER_ID_PREFIX + id : null;
    }

    private static String fighterName(JsonNode fighter) {
        String name = fighter.path("athlete").path("displayName").asText("").trim();
        return name.isEmpty() ? "Por definir" : name;
    }

    private static Instant instant(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return ZonedDateTime.parse(iso).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private JsonNode request(String url) throws Exception {
        CircuitBreaker breaker = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER);
        try {
            return breaker.executeCallable(() -> {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(15))
                        .header("Accept", "application/json")
                        .GET()
                        .build();
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                int status = response.statusCode();
                if (status < 200 || status >= 300) throw new IOException("ESPN (UFC) devolvió HTTP " + status);
                byte[] body = response.body();
                if (body == null || body.length == 0) throw new IOException("ESPN (UFC) devolvió una respuesta vacía");
                return objectMapper.readTree(new String(body, StandardCharsets.UTF_8));
            });
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        }
    }
}
