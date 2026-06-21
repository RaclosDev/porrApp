package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * ⚽ Servicio de Pichichi — Extracts top scorers from ESPN match details
 * - Refreshes every 30 minutes via @Scheduled
 * - Also refreshable on demand (e.g., when a match finishes)
 * - Uses ESPN's free public API (no API key needed)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TopScorerService {

    private final ObjectMapper objectMapper;
    private final WebSocketService webSocketService;
    private final HttpClient httpClient;

    @Value("${app.espn.scoreboard-url}")
    private String espnScoreboardUrl;

    // Date range covering the entire World Cup
    private static final String WC_DATE_RANGE = "20260611-20260722";

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
            String url = espnScoreboardUrl + "?dates=" + WC_DATE_RANGE + "&limit=200";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("TopScorerService: ESPN API returned status {}", response.statusCode());
                return;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode events = root.path("events");

            if (!events.isArray()) {
                log.warn("TopScorerService: No events array found in ESPN response");
                return;
            }

            // Count goals per player across all matches
            Map<String, int[]> playerGoals = new LinkedHashMap<>(); // name -> [goals]
            Map<String, String> playerShortNames = new HashMap<>(); // name -> shortName
            Map<String, String> playerPositions = new HashMap<>();  // name -> position
            Map<String, String> playerIds = new HashMap<>();        // name -> ESPN player id

            for (JsonNode event : events) {
                JsonNode competition = event.path("competitions").get(0);
                if (competition == null) continue;

                JsonNode details = competition.path("details");
                if (!details.isArray()) continue;

                for (JsonNode detail : details) {
                    // Only count scoring plays (goals)
                    if (!detail.path("scoringPlay").asBoolean(false)) continue;
                    // Skip own goals — they don't count for pichichi
                    if (detail.path("ownGoal").asBoolean(false)) continue;

                    JsonNode athletes = detail.path("athletesInvolved");
                    if (!athletes.isArray() || athletes.isEmpty()) continue;

                    // First athlete involved is the goal scorer
                    JsonNode scorer = athletes.get(0);
                    String fullName = scorer.path("displayName").asText("").trim();
                    String shortName = scorer.path("shortName").asText(fullName).trim();
                    String position = scorer.path("position").asText("");
                    String playerId = scorer.path("id").asText("");

                    if (fullName.isEmpty()) continue;

                    playerGoals.computeIfAbsent(fullName, k -> new int[1]);
                    playerGoals.get(fullName)[0]++;
                    playerShortNames.put(fullName, shortName);
                    playerPositions.put(fullName, position);
                    playerIds.put(fullName, playerId);
                }
            }

            // Convert to list and sort by goals descending
            List<Map<String, Object>> scorers = new ArrayList<>();
            for (Map.Entry<String, int[]> entry : playerGoals.entrySet()) {
                Map<String, Object> scorer = new LinkedHashMap<>();
                scorer.put("name", entry.getKey());
                scorer.put("shortName", playerShortNames.getOrDefault(entry.getKey(), entry.getKey()));
                scorer.put("goals", entry.getValue()[0]);
                scorer.put("position", playerPositions.getOrDefault(entry.getKey(), ""));
                scorer.put("playerId", playerIds.getOrDefault(entry.getKey(), ""));
                scorers.add(scorer);
            }

            scorers.sort((a, b) -> Integer.compare((int) b.get("goals"), (int) a.get("goals")));

            cachedScorers.set(scorers);
            log.info("TopScorerService: Refreshed {} scorers from ESPN. Leader: {} ({} goals)",
                    scorers.size(),
                    scorers.isEmpty() ? "none" : scorers.get(0).get("name"),
                    scorers.isEmpty() ? 0 : scorers.get(0).get("goals"));

            webSocketService.invalidateAndNotify();

        } catch (Exception e) {
            log.error("TopScorerService: Failed to fetch scorers from ESPN: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> getTopScorers() {
        return cachedScorers.get();
    }
}
