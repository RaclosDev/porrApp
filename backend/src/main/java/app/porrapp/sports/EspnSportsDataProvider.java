package app.porrapp.sports;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.GZIPInputStream;

@Component
@Primary
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class EspnSportsDataProvider implements SportsDataProvider {

    /** Circuit breaker de las llamadas a ESPN, configurado en application.properties. */
    public static final String CIRCUIT_BREAKER = "sportsApi";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    private static final String BASE_SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/";
    private static final String BASE_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/";

    /** Competiciones de ESPN que no son de fútbol, con su ruta en la API («deporte/liga»). */
    private static final Map<String, String> OTHER_SPORT_PATHS = Map.of(NflSchedule.EXTERNAL_ID, NflSchedule.ESPN_PATH);

    private static final Set<String> KNOWN_SLUGS = Set.of(
            "esp.1", "esp.2", "esp.copa_del_rey", "uefa.champions", "uefa.europa",
            "uefa.europa.conf", "eng.1", "ita.1", "ger.1", "fra.1", "fifa.world", "uefa.euro",
            "conmebol.libertadores", "mex.1", "usa.1", "por.1", "ned.1"
    );

    @Override
    public String getProviderName() {
        return "ESPN";
    }

    /** Solo las competiciones de ESPN que conoce por su id: ni nombres ni competiciones sin id. */
    @Override
    public boolean supports(String competitionCode) {
        if (competitionCode == null || competitionCode.isBlank()) return false;
        String slug = competitionCode.toLowerCase(java.util.Locale.ROOT).trim();
        return KNOWN_SLUGS.contains(slug) || OTHER_SPORT_PATHS.containsKey(slug);
    }

    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = siteUrl(slug) + "/scoreboard";

        if (dateRange != null && !dateRange.isBlank() && !dateRange.contains("-")) {
            url += "?dates=" + dateRange + "&limit=1000";
        } else {
            url += "?limit=1000";
        }

        JsonNode root = executeGet(url);
        if (root == null) return objectMapper.createArrayNode();
        JsonNode events = root.path("events");
        if (!events.isArray()) throw new IOException("ESPN devolvió un marcador sin events");
        if (NflSchedule.isNfl(slug)) NflSchedule.namespaceTeamIds(events);
        return events;
    }

    @Override
    public JsonNode fetchEvent(String competitionSlug, String eventId) throws Exception {
        String slug = resolveSlug(competitionSlug);
        if (!(KNOWN_SLUGS.contains(slug) || OTHER_SPORT_PATHS.containsKey(slug)) || eventId == null || !eventId.matches("[0-9]{1,20}")) {
            throw new IllegalArgumentException("Competición o identificador de evento no válido");
        }
        JsonNode header = executeGet(siteUrl(slug) + "/summary?event=" + eventId).path("header");
        JsonNode competitions = header.path("competitions");
        if (!eventId.equals(header.path("id").asText()) || !slug.equals(header.path("league").path("slug").asText())
                || !competitions.isArray() || competitions.size() != 1
                || !eventId.equals(competitions.get(0).path("id").asText())) {
            throw new IOException("El resumen de ESPN no corresponde al evento y competición solicitados");
        }
        var event = objectMapper.createObjectNode();
        event.put("id", eventId);
        event.put("date", competitions.get(0).path("date").asText());
        event.set("competitions", competitions);
        event.set("season", header.path("season"));
        event.set("league", header.path("league"));
        event.set("week", header.path("week"));
        if (NflSchedule.isNfl(slug)) NflSchedule.namespaceTeamIds(event);
        return event;
    }

    @Override
    public JsonNode fetchTeams(String competitionSlug) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = siteUrl(slug) + "/teams";

        JsonNode root = executeGet(url);
        if (root == null) return objectMapper.createArrayNode();

        JsonNode teamsArray = teamsOf(root);
        if (!teamsArray.isArray()) return objectMapper.createArrayNode();
        if (NflSchedule.isNfl(slug)) NflSchedule.namespaceTeamIds(teamsArray);
        else addSpanishNames(teamsArray, teamsOf(executeGet(url + "?lang=es")));
        return teamsArray;
    }

    private static JsonNode teamsOf(JsonNode root) {
        return root.path("sports").path(0).path("leagues").path(0).path("teams");
    }

    /**
     * El catálogo se pide en inglés, que es como llegan los equipos en los partidos, y otra vez en español:
     * ESPN ya traduce selecciones y clubes, y ese es el nombre con el que nace un equipo nuevo.
     */
    private static void addSpanishNames(JsonNode teams, JsonNode spanishTeams) {
        Map<String, String> spanish = new java.util.HashMap<>();
        for (JsonNode item : spanishTeams) {
            JsonNode team = item.path("team");
            String name = team.path("displayName").asText("");
            if (!name.isBlank()) spanish.put(team.path("id").asText(), name);
        }
        for (JsonNode item : teams) {
            String name = spanish.get(item.path("team").path("id").asText());
            if (name != null && item.path("team") instanceof tools.jackson.databind.node.ObjectNode team) {
                team.put(LOCAL_NAME_FIELD, name);
            }
        }
    }

    @Override
    public JsonNode fetchStandings(String competitionSlug) throws Exception {
        String slug = resolveSlug(competitionSlug);
        // La NFL, por divisiones (level=3): sin él, ESPN la da solo por conferencias.
        String url = BASE_STANDINGS_URL + sportPath(slug) + "/standings" + (NflSchedule.isNfl(slug) ? "?level=3" : "");

        return executeGet(url);
    }

    @Override
    public List<String> fetchSeasonCalendarDates(String competitionSlug) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = siteUrl(slug) + "/scoreboard";

        JsonNode root = executeGet(url);
        if (root == null) return Collections.emptyList();

        JsonNode calendarNode = root.path("leagues").path(0).path("calendar");
        List<String> dates = new ArrayList<>();

        if (calendarNode.isArray()) {
            for (JsonNode item : calendarNode) {
                if (item.isTextual()) {
                    dates.add(item.asText());
                } else if (item.has("entries")) {
                    for (JsonNode entry : item.path("entries")) {
                        String start = entry.path("startDate").asText(null);
                        if (start != null) dates.add(start);
                    }
                }
            }
        }
        return dates;
    }

    /** El marcador sin fecha trae el calendario de la temporada en curso ({@code calendarStartDate}/{@code EndDate}). */
    @Override
    public SeasonWindow fetchSeasonWindow(String competitionSlug) throws Exception {
        JsonNode league = executeGet(siteUrl(resolveSlug(competitionSlug)) + "/scoreboard")
                .path("leagues").path(0);
        String start = league.path("calendarStartDate").asText(null);
        String end = league.path("calendarEndDate").asText(null);
        return start == null || end == null ? null : new SeasonWindow(start, end);
    }

    /**
     * JSON de una URL de la API de ESPN (otros deportes, como la Fórmula 1 o la NBA), con el mismo circuit breaker.
     * Solo admite los hosts de ESPN.
     */
    public JsonNode fetchEspnJson(String url) throws Exception {
        if (url == null || !(url.startsWith("https://site.api.espn.com/") || url.startsWith("https://sports.core.api.espn.com/"))) {
            throw new IllegalArgumentException("URL de ESPN no válida");
        }
        return executeGet(url);
    }

    /** Un fallo no equivale a una jornada vacía; el sincronizador registra el error. */
    private JsonNode executeGet(String url) throws Exception {
        CircuitBreaker breaker = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER);
        try {
            JsonNode result = breaker.executeCallable(() -> request(url));
            if (result == null) throw new IOException("ESPN no devolvió datos válidos");
            return result;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        }
    }

    @Override
    public boolean isAvailable() {
        CircuitBreaker.State state = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER).getState();
        return state != CircuitBreaker.State.OPEN && state != CircuitBreaker.State.FORCED_OPEN;
    }

    private JsonNode request(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("Accept-Encoding", "identity")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        byte[] bodyBytes = response.body();

        int status = response.statusCode();
        if (status >= 500 || status == 429) {
            throw new IOException("ESPN API returned HTTP " + status);
        }
        if (status < 200 || status >= 300) {
            // Un 4xx es de la petición (slug o fecha que ESPN no conoce), no de que ESPN esté caído.
            log.warn("ESPN API returned HTTP {}: {}", status, url);
            return null;
        }

        if (bodyBytes == null || bodyBytes.length == 0) {
            return null;
        }

        String json;
        String contentEncoding = response.headers().firstValue("Content-Encoding").orElse("");
        boolean isGzip = "gzip".equalsIgnoreCase(contentEncoding)
                || (bodyBytes.length >= 2 && bodyBytes[0] == (byte) 0x1f && bodyBytes[1] == (byte) 0x8b);

        if (isGzip) {
            try (GZIPInputStream gis = new GZIPInputStream(new ByteArrayInputStream(bodyBytes))) {
                json = new String(gis.readAllBytes(), StandardCharsets.UTF_8);
            }
        } else {
            json = new String(bodyBytes, StandardCharsets.UTF_8);
        }

        if (json == null || !json.trim().startsWith("{")) {
            log.warn("ESPN API response is not JSON from {}: {}", url, json != null && json.length() > 200 ? json.substring(0, 200) : json);
            return null;
        }

        return objectMapper.readTree(json);
    }

    /** Ruta de la competición en ESPN: «soccer/esp.1», «football/nfl»… */
    private static String sportPath(String slug) {
        return OTHER_SPORT_PATHS.getOrDefault(slug, "soccer/" + slug);
    }

    private static String siteUrl(String slug) {
        return BASE_SITE_URL + sportPath(slug);
    }

    /** Id de ESPN de la competición; sin id no se adivina ninguna liga. */
    private String resolveSlug(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Falta el id de la competición en ESPN");
        }
        return code.toLowerCase(java.util.Locale.ROOT).trim();
    }
}
