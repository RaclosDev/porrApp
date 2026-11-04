package com.porra.mundial.sports;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Calendario y resultados de competiciones de League of Legends desde la API REST de lolesports.com.
 * <p>
 * La API no es oficial ni está documentada: es la que usa la web de lolesports con su clave pública.
 * Cada serie se traduce al formato de evento de ESPN para que {@code MatchEventProcessor} la procese como
 * cualquier otro partido: el marcador es el número de partidas ganadas (2-1 en un Bo3).
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@Slf4j
public class LolEsportsDataProvider implements SportsDataProvider {

    /** Circuit breaker propio: un fallo de lolesports no debe cortar la sincronización del fútbol. */
    public static final String CIRCUIT_BREAKER = "lolesportsApi";
    public static final String EXTERNAL_ID_PREFIX = "lol.";
    /** Prefijo del id externo de los equipos, para no mezclarlos con los de ESPN. */
    static final String TEAM_ID_PREFIX = "lol-";

    private static final String BASE_URL = "https://esports-api.lolesports.com/persisted/gw/getSchedule";
    private static final Map<String, String> LEAGUE_IDS = Map.of(
            "lol.worlds", "98767975604431411",
            "lol.msi", "98767991325878492");
    private static final ZoneId SPAIN_ZONE = ZoneId.of("Europe/Madrid");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    /** Páginas que se siguen en cada sentido; cada una trae unas pocas decenas de series. */
    private static final int MAX_PAGES = 10;
    /** Hasta dónde se retrocede en el histórico: cubre la temporada que importa {@code SyncService}. */
    private static final Duration HISTORY = Duration.ofDays(200);
    /** La sincronización pide varios días seguidos: se reutiliza el calendario descargado. */
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);
    private static final int MAX_TOKEN_LENGTH = 200;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final String apiKey;
    private final Map<String, CachedSchedule> cache = new ConcurrentHashMap<>();

    private record CachedSchedule(List<JsonNode> events, Instant fetchedAt) {}

    public LolEsportsDataProvider(HttpClient httpClient, ObjectMapper objectMapper,
                                  CircuitBreakerRegistry circuitBreakerRegistry,
                                  @Value("${lolesports.api-key:}") String apiKey) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
        this.apiKey = apiKey;
    }

    public static boolean isLolCompetition(String externalId) {
        return externalId != null && externalId.toLowerCase(Locale.ROOT).startsWith(EXTERNAL_ID_PREFIX);
    }

    @Override
    public String getProviderName() {
        return "lolesports";
    }

    @Override
    public boolean supports(String competitionCode) {
        return competitionCode != null && LEAGUE_IDS.containsKey(competitionCode.toLowerCase(Locale.ROOT).trim());
    }

    @Override
    public boolean isAvailable() {
        CircuitBreaker.State state = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER).getState();
        return state != CircuitBreaker.State.OPEN && state != CircuitBreaker.State.FORCED_OPEN;
    }

    @Override
    public JsonNode fetchScoreboardEvents(String dateRange) {
        throw new UnsupportedOperationException("lolesports necesita la competición");
    }

    /**
     * Series de la competición. {@code dateRange} admite un día (yyyyMMdd, en hora peninsular), un año
     * (yyyy) o nada para todo lo descargado.
     */
    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        ArrayNode result = objectMapper.createArrayNode();
        for (JsonNode event : schedule(competitionSlug)) {
            Instant start = startTime(event);
            if (start != null && matchesRange(start, dateRange)) {
                JsonNode adapted = adapt(event);
                if (adapted != null) result.add(adapted);
            }
        }
        return result;
    }

    @Override
    public JsonNode fetchEvent(String competitionSlug, String eventId) throws Exception {
        for (JsonNode event : schedule(competitionSlug)) {
            if (eventId != null && eventId.equals(event.path("match").path("id").asText(null))) {
                JsonNode adapted = adapt(event);
                if (adapted != null) return adapted;
            }
        }
        throw new IOException("lolesports no tiene la serie " + eventId);
    }

    /** Equipos que aparecen en el calendario, sin los huecos "TBD" de las rondas por decidir. */
    @Override
    public JsonNode fetchTeams(String competitionSlug) throws Exception {
        Map<String, ObjectNode> teams = new LinkedHashMap<>();
        for (JsonNode event : schedule(competitionSlug)) {
            for (JsonNode team : event.path("match").path("teams")) {
                if (!isRealTeam(team)) continue;
                teams.computeIfAbsent(team.path("code").asText(), code -> teamNode(team));
            }
        }
        ArrayNode result = objectMapper.createArrayNode();
        teams.values().forEach(result::add);
        return result;
    }

    private static boolean matchesRange(Instant start, String dateRange) {
        if (dateRange == null || dateRange.isBlank() || dateRange.contains("-")) return true;
        LocalDate day = start.atZone(SPAIN_ZONE).toLocalDate();
        if (dateRange.length() == 4) return dateRange.equals(String.valueOf(day.getYear()));
        return dateRange.equals(day.format(DAY));
    }

    private List<JsonNode> schedule(String competitionSlug) throws Exception {
        String leagueId = competitionSlug == null ? null : LEAGUE_IDS.get(competitionSlug.toLowerCase(Locale.ROOT).trim());
        if (leagueId == null) throw new IllegalArgumentException("Competición de lolesports desconocida: " + competitionSlug);
        CachedSchedule cached = cache.get(leagueId);
        if (cached != null && Instant.now().isBefore(cached.fetchedAt().plus(CACHE_TTL))) return cached.events();

        List<JsonNode> events = new ArrayList<>();
        JsonNode first = page(leagueId, null);
        first.path("events").forEach(events::add);

        Instant historyStart = Instant.now().minus(HISTORY);
        String older = first.path("pages").path("older").asText(null);
        for (int i = 0; i < MAX_PAGES && older != null && !reachedHistoryStart(events, historyStart); i++) {
            JsonNode page = page(leagueId, older);
            page.path("events").forEach(events::add);
            older = page.path("pages").path("older").asText(null);
        }
        String newer = first.path("pages").path("newer").asText(null);
        for (int i = 0; i < MAX_PAGES && newer != null; i++) {
            JsonNode page = page(leagueId, newer);
            page.path("events").forEach(events::add);
            newer = page.path("pages").path("newer").asText(null);
        }
        List<JsonNode> snapshot = List.copyOf(events);
        cache.put(leagueId, new CachedSchedule(snapshot, Instant.now()));
        return snapshot;
    }

    private static boolean reachedHistoryStart(List<JsonNode> events, Instant historyStart) {
        return events.stream().map(LolEsportsDataProvider::startTime)
                .anyMatch(start -> start != null && start.isBefore(historyStart));
    }

    private JsonNode page(String leagueId, String pageToken) throws Exception {
        String url = BASE_URL + "?hl=en-US&leagueId=" + leagueId;
        if (pageToken != null) {
            if (pageToken.isBlank() || pageToken.length() > MAX_TOKEN_LENGTH) throw new IOException("Token de página no válido");
            url += "&pageToken=" + URLEncoder.encode(pageToken, StandardCharsets.UTF_8);
        }
        String requestUrl = url;
        CircuitBreaker breaker = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER);
        try {
            JsonNode schedule = breaker.executeCallable(() -> request(requestUrl)).path("data").path("schedule");
            if (!schedule.path("events").isArray()) throw new IOException("lolesports devolvió un calendario sin events");
            return schedule;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        }
    }

    private JsonNode request(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("x-api-key", apiKey)
                .GET()
                .build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        int status = response.statusCode();
        if (status < 200 || status >= 300) throw new IOException("lolesports devolvió HTTP " + status);
        byte[] body = response.body();
        if (body == null || body.length == 0) throw new IOException("lolesports devolvió una respuesta vacía");
        return objectMapper.readTree(new String(body, StandardCharsets.UTF_8));
    }

    /** Serie en formato de evento ESPN, o null si no es un partido con dos equipos. */
    private JsonNode adapt(JsonNode event) {
        JsonNode match = event.path("match");
        String id = match.path("id").asText(null);
        JsonNode teams = match.path("teams");
        if (!"match".equals(event.path("type").asText("match")) || id == null || !teams.isArray() || teams.size() != 2) {
            return null;
        }
        String state = event.path("state").asText("");
        boolean completed = "completed".equals(state);
        boolean live = "inProgress".equals(state);

        ObjectNode statusType = objectMapper.createObjectNode()
                .put("state", completed ? "post" : live ? "in" : "pre")
                .put("completed", completed);
        ObjectNode status = objectMapper.createObjectNode();
        status.set("type", statusType);

        ArrayNode competitors = objectMapper.createArrayNode();
        for (int i = 0; i < 2; i++) {
            JsonNode team = teams.get(i);
            ObjectNode competitor = objectMapper.createObjectNode().put("homeAway", i == 0 ? "home" : "away");
            if (isRealTeam(team)) competitor.set("team", teamNode(team));
            JsonNode result = team.path("result");
            if ((completed || live) && result.path("gameWins").isNumber()) {
                competitor.put("score", result.path("gameWins").asText());
            }
            competitor.put("winner", "win".equals(result.path("outcome").asText()));
            competitors.add(competitor);
        }

        String blockName = event.path("blockName").asText("");
        ObjectNode competition = objectMapper.createObjectNode().put("id", id).put("altGameNote", blockName);
        competition.set("status", status);
        competition.set("competitors", competitors);

        ObjectNode adapted = objectMapper.createObjectNode().put("id", id).put("date", event.path("startTime").asText());
        adapted.putArray("competitions").add(competition);
        adapted.putObject("season").put("slug", roundSlug(blockName));
        return adapted;
    }

    /** Fase de lolesports como {@code season.slug} de ESPN: Play-In y fase suiza cuentan como fase previa. */
    static String roundSlug(String blockName) {
        String block = blockName == null ? "" : blockName.toLowerCase(Locale.ROOT);
        if (block.contains("quarter")) return "quarterfinals";
        if (block.contains("semi")) return "semifinals";
        if (block.contains("final")) return "final";
        return "group-stage";
    }

    private ObjectNode teamNode(JsonNode team) {
        return objectMapper.createObjectNode()
                .put("id", TEAM_ID_PREFIX + team.path("code").asText())
                .put("displayName", team.path("name").asText())
                .put("abbreviation", team.path("code").asText())
                .put("logo", team.path("image").asText(null));
    }

    private static boolean isRealTeam(JsonNode team) {
        String code = team.path("code").asText("");
        String name = team.path("name").asText("");
        return !code.isBlank() && !name.isBlank() && !"TBD".equalsIgnoreCase(code) && !"TBD".equalsIgnoreCase(name);
    }

    private static Instant startTime(JsonNode event) {
        try {
            return Instant.parse(event.path("startTime").asText(""));
        } catch (Exception e) {
            return null;
        }
    }
}
