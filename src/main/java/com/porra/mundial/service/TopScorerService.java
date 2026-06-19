package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * ⚽ Servicio de Pichichi — Fetches and caches top scorers from SportsApiPro
 * - Refreshes every 30 minutes via @Scheduled
 * - Also refreshable on demand (e.g., when a match finishes)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TopScorerService {

    private final ObjectMapper objectMapper;
    private final SseService sseService;
    private final org.springframework.cache.CacheManager cacheManager;

    @Value("${app.sportsapi.key}")
    private String apiKey;

    private static final String STATS_URL = "https://v1.football.sportsapipro.com/api/v1/world-cup/stats";

    // Cached list of top scorers (thread-safe)
    private final AtomicReference<List<Map<String, Object>>> cachedScorers = new AtomicReference<>(Collections.emptyList());


    /** Called every 30 minutes */
    @Scheduled(fixedDelay = 1_800_000)
    public void scheduledRefresh() {
        refresh();
    }

    /** Call this when a match just finished */
    public void refresh() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(STATS_URL))
                    .header("x-api-key", apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("TopScorerService: API returned status {}", response.statusCode());
                return;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode athletesStats = root.path("data").path("stats").path("athletesStats");

            if (!athletesStats.isArray() || athletesStats.isEmpty()) {
                log.warn("TopScorerService: No athletesStats array found");
                return;
            }

            // First category (index 0) = Goals (typeId=1)
            JsonNode goalsCategory = athletesStats.get(0);
            JsonNode players = goalsCategory.path("rows");

            if (!players.isArray()) {
                log.warn("TopScorerService: No rows array in goals category");
                return;
            }

            List<Map<String, Object>> scorers = new ArrayList<>();
            for (JsonNode player : players) {
                JsonNode entity = player.path("entity");
                JsonNode stats = player.path("stats");

                int goals = 0;
                for (JsonNode stat : stats) {
                    if (stat.path("typeId").asInt() == 1) {
                        goals = stat.path("value").asInt();
                        break;
                    }
                }

                Map<String, Object> scorer = new LinkedHashMap<>();
                scorer.put("name", entity.path("name").asText());
                scorer.put("shortName", entity.path("shortName").asText());
                scorer.put("goals", goals);
                scorer.put("position", entity.path("positionShortName").asText());
                scorer.put("playerId", entity.path("id").asLong());
                scorer.put("teamId", entity.path("competitorId").asLong()); // Added teamId for mapping
                scorers.add(scorer);
            }

            // Sort by goals descending
            scorers.sort((a, b) -> Integer.compare((int) b.get("goals"), (int) a.get("goals")));

            cachedScorers.set(scorers);
            log.info("TopScorerService: Refreshed {} top scorers. Leader: {} ({} goals)",
                    scorers.size(),
                    scorers.isEmpty() ? "none" : scorers.get(0).get("name"),
                    scorers.isEmpty() ? 0 : scorers.get(0).get("goals"));

            org.springframework.cache.Cache cache = cacheManager.getCache("leaderboard");
            if (cache != null) cache.clear();
            sseService.broadcastUpdate("DATA_UPDATED");

        } catch (Exception e) {
            log.error("TopScorerService: Failed to fetch scorers: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> getTopScorers() {
        return cachedScorers.get();
    }
}
