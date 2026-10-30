package com.porra.mundial.sports;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
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
import java.util.Set;
import java.util.zip.GZIPInputStream;

@Component
@Primary
@RequiredArgsConstructor
@Slf4j
public class EspnSportsDataProvider implements SportsDataProvider {

    /** Circuit breaker de las llamadas a ESPN, configurado en application.properties. */
    public static final String CIRCUIT_BREAKER = "sportsApi";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    private static final String BASE_SOCCER_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    private static final String BASE_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer";

    private static final Set<String> KNOWN_SLUGS = Set.of(
            "esp.1", "esp.2", "esp.copa_del_rey", "uefa.champions", "uefa.europa",
            "uefa.europa.conf", "eng.1", "ita.1", "ger.1", "fra.1", "fifa.world",
            "conmebol.libertadores", "mex.1", "usa.1", "por.1", "ned.1"
    );

    @Override
    public String getProviderName() {
        return "ESPN";
    }

    @Override
    public boolean supports(String competitionCode) {
        if (competitionCode == null || competitionCode.isBlank()) return true;
        String lower = competitionCode.toLowerCase().trim();
        if (KNOWN_SLUGS.contains(lower)) return true;
        return lower.contains("laliga") || lower.contains("champions") || lower.contains("premier")
                || lower.contains("world cup") || lower.contains("mundial") || lower.contains("serie a")
                || lower.contains("bundesliga") || lower.contains("ligue 1") || lower.contains("copa")
                || lower.contains("libertadores") || lower.contains("mls");
    }

    @Override
    public JsonNode fetchScoreboardEvents(String dateRange) throws Exception {
        return fetchScoreboardEvents("fifa.world", dateRange);
    }

    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = BASE_SOCCER_URL + "/" + slug + "/scoreboard";

        if ("fifa.world".equalsIgnoreCase(slug)) {
            String dateParam = (dateRange != null && !dateRange.isBlank() && !dateRange.contains("-")) ? dateRange : "2026";
            url += "?dates=" + dateParam + "&limit=1000";
        } else if (dateRange != null && !dateRange.isBlank() && !dateRange.contains("-")) {
            url += "?dates=" + dateRange + "&limit=1000";
        } else {
            url += "?limit=1000";
        }

        JsonNode root = executeGet(url);
        if (root == null) return objectMapper.createArrayNode();
        JsonNode events = root.path("events");
        return events.isArray() ? events : objectMapper.createArrayNode();
    }

    @Override
    public JsonNode fetchTeams(String competitionSlug) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = BASE_SOCCER_URL + "/" + slug + "/teams";

        JsonNode root = executeGet(url);
        if (root == null) return objectMapper.createArrayNode();

        JsonNode teamsArray = root.path("sports").path(0).path("leagues").path(0).path("teams");
        return teamsArray.isArray() ? teamsArray : objectMapper.createArrayNode();
    }

    @Override
    public JsonNode fetchStandings(String competitionSlug) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = BASE_STANDINGS_URL + "/" + slug + "/standings";

        return executeGet(url);
    }

    @Override
    public List<String> fetchSeasonCalendarDates(String competitionSlug) throws Exception {
        String slug = resolveSlug(competitionSlug);
        String url = BASE_SOCCER_URL + "/" + slug + "/scoreboard";

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

    /**
     * GET a ESPN a través del circuit breaker. Nunca lanza: ante cualquier fallo devuelve null.
     * Los timeouts, errores de red y respuestas 5xx o 429 cuentan como fallos del breaker; con él
     * abierto no se llama a ESPN hasta que pase el tiempo de espera configurado.
     */
    private JsonNode executeGet(String url) {
        CircuitBreaker breaker = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER);
        try {
            return breaker.executeCallable(() -> request(url));
        } catch (CallNotPermittedException e) {
            log.debug("Circuit breaker de ESPN abierto: no se pide {}", url);
            return null;
        } catch (Exception e) {
            log.warn("Failed ESPN request to {}: {}", url, e.getMessage());
            return null;
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

    private String resolveSlug(String code) {
        if (code == null || code.isBlank()) return "esp.1";
        String lower = code.toLowerCase().trim();
        if (KNOWN_SLUGS.contains(lower)) return lower;

        if (lower.contains("laliga") || lower.contains("la liga") || lower.contains("primera")) return "esp.1";
        if (lower.contains("segunda") || lower.contains("hypermotion")) return "esp.2";
        if (lower.contains("champions")) return "uefa.champions";
        if (lower.contains("europa league") || (lower.contains("europa") && !lower.contains("conf"))) return "uefa.europa";
        if (lower.contains("conference")) return "uefa.europa.conf";
        if (lower.contains("copa del rey")) return "esp.copa_del_rey";
        if (lower.contains("premier")) return "eng.1";
        if (lower.contains("serie a")) return "ita.1";
        if (lower.contains("bundesliga")) return "ger.1";
        if (lower.contains("ligue 1")) return "fra.1";
        if (lower.contains("world cup") || lower.contains("mundial")) return "fifa.world";
        if (lower.contains("libertadores")) return "conmebol.libertadores";
        if (lower.contains("mex") || lower.contains("liga mx")) return "mex.1";
        if (lower.contains("mls")) return "usa.1";

        return lower;
    }
}
