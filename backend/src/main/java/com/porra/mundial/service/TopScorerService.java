package com.porra.mundial.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.dto.TopScorerDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
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
import java.util.Comparator;

/** Goleadores del Mundial a partir de los partidos de ESPN; se refresca cada 30 min y al terminar un partido. */
@Service
@Slf4j
public class TopScorerService {

    private final ObjectMapper objectMapper;
    private final WebSocketService webSocketService;
    private final HttpClient httpClient;
    private final SportsDataProvider sportsDataProvider;
    private final ScoreInvalidationService scoreInvalidationService;

    public TopScorerService(
            ObjectMapper objectMapper,
            WebSocketService webSocketService,
            HttpClient httpClient,
            @Qualifier("espnSportsDataProvider") SportsDataProvider sportsDataProvider,
            ScoreInvalidationService scoreInvalidationService) {
        this.objectMapper = objectMapper;
        this.webSocketService = webSocketService;
        this.httpClient = httpClient;
        this.sportsDataProvider = sportsDataProvider;
        this.scoreInvalidationService = scoreInvalidationService;
    }

    // Date range covering the entire World Cup
    private static final String WC_DATE_RANGE = "2026";

    // Cached list of top scorers (thread-safe)
    private final AtomicReference<List<TopScorerDTO>> cachedScorers = new AtomicReference<>(Collections.emptyList());

    // Persistent cache of player name -> image URL (avoids re-fetching every 30 min)
    private final Map<String, String> imageCache = new java.util.concurrent.ConcurrentHashMap<>();

    // Hardcoded cartoon URLs for known pichichi contenders (from thesportsdb)
    private static final Map<String, String> CARTOON_MAP = new HashMap<>(Map.of(
        "Kylian Mbappé", "https://r2.thesportsdb.com/images/media/player/cartoon/mya0j81771265711.png",
        "Lionel Messi", "https://r2.thesportsdb.com/images/media/player/cartoon/kzz67d1768229024.png",
        "Erling Haaland", "https://r2.thesportsdb.com/images/media/player/cartoon/z3i9s51769182480.png",
        "Vinícius Júnior", "https://r2.thesportsdb.com/images/media/player/cartoon/vq5z4u1771264896.png",
        "Vinicius Junior", "https://r2.thesportsdb.com/images/media/player/cartoon/vq5z4u1771264896.png"
    ));

    @Scheduled(initialDelay = 5_000, fixedDelay = 1_800_000)
    public void scheduledRefresh() {
        refresh();
    }

    /** También se llama al terminar un partido. */
    public void refresh() {
        try {
            JsonNode events = sportsDataProvider.fetchScoreboardEvents(WC_DATE_RANGE);
            if (events == null) return;

            Map<String, int[]> playerGoals = new LinkedHashMap<>();
            Map<String, String> playerShortNames = new HashMap<>();
            Map<String, String> playerPositions = new HashMap<>();
            Map<String, String> playerIds = new HashMap<>();
            Map<String, String> playerTeams = new HashMap<>();
            Map<String, String> playerImages = new HashMap<>();

            processEvents(events, playerGoals, playerShortNames, playerPositions, playerIds, playerTeams, playerImages);

            List<TopScorerDTO> scorers = buildScorersList(playerGoals, playerShortNames, playerPositions, playerIds, playerTeams, playerImages);
            List<TopScorerDTO> previous = cachedScorers.get();
            if (scorers.isEmpty() && !previous.isEmpty()) {
                // Los goles no se pierden: una lista vacía tras tener goleadores es que ESPN no ha respondido.
                log.warn("TopScorerService: ESPN no ha devuelto goleadores; se conservan los {} anteriores", previous.size());
                return;
            }
            cachedScorers.set(scorers);
            if (!scorers.equals(previous)) {
                // El pichichi puntúa los cuadros.
                scoreInvalidationService.invalidateWorldCup();
                webSocketService.broadcastUpdate("DATA_UPDATED");
            }
            log.info("TopScorerService: Refreshed {} scorers from ESPN. Leader: {} ({} goals)",
                    scorers.size(),
                    scorers.isEmpty() ? "none" : scorers.get(0).name(),
                    scorers.isEmpty() ? 0 : scorers.get(0).goals());

        } catch (Exception e) {
            log.error("TopScorerService: Failed to fetch scorers from ESPN: {}", e.getMessage());
        }
    }



    private void processEvents(JsonNode events, Map<String, int[]> playerGoals, Map<String, String> playerShortNames,
                               Map<String, String> playerPositions, Map<String, String> playerIds,
                               Map<String, String> playerTeams, Map<String, String> playerImages) {
        for (JsonNode event : events) {
            JsonNode competitionNode = event.path("competitions").get(0);
            if (competitionNode == null) continue;

            Map<String, String> teamNames = buildTeamNamesMap(competitionNode);
            JsonNode details = competitionNode.path("details");
            if (!details.isArray()) continue;

            for (JsonNode detail : details) {
                processDetail(detail, teamNames, playerGoals, playerShortNames, playerPositions, playerIds, playerTeams, playerImages);
            }
        }
    }

    private Map<String, String> buildTeamNamesMap(JsonNode competitionNode) {
        Map<String, String> teamNames = new HashMap<>();
        JsonNode competitors = competitionNode.path("competitors");
        if (competitors.isArray()) {
            for (JsonNode comp : competitors) {
                String tid = comp.path("id").asText("");
                String tname = comp.path("team").path("displayName").asText("");
                if (!tid.isEmpty() && !tname.isEmpty()) teamNames.put(tid, tname);
            }
        }
        return teamNames;
    }

    private void processDetail(JsonNode detail, Map<String, String> teamNames,
                               Map<String, int[]> playerGoals, Map<String, String> playerShortNames,
                               Map<String, String> playerPositions, Map<String, String> playerIds,
                               Map<String, String> playerTeams, Map<String, String> playerImages) {
        if (!detail.path("scoringPlay").asBoolean(false)) return;
        if (detail.path("ownGoal").asBoolean(false)) return;

        JsonNode athletes = detail.path("athletesInvolved");
        if (!athletes.isArray() || athletes.isEmpty()) return;

        JsonNode scorer = athletes.get(0);
        String fullName = scorer.path("displayName").asText("").trim();
        if (fullName.isEmpty()) return;

        String shortName = getShortName(scorer, fullName);
        String position = scorer.path("position").asText("");
        String playerId = scorer.path("id").asText("");
        String teamName = getTeamName(scorer, detail, teamNames);
        String imageUrl = fetchImageUrl(fullName);

        playerGoals.computeIfAbsent(fullName, k -> new int[1])[0]++;
        playerShortNames.put(fullName, shortName);
        playerPositions.put(fullName, position);
        playerIds.put(fullName, playerId);
        playerTeams.put(fullName, teamName);
        playerImages.put(fullName, imageUrl);
    }

    private String getShortName(JsonNode scorer, String fullName) {
        String shortName = scorer.path("shortName").asText(fullName).trim();
        if (shortName.equals(fullName) || (!shortName.contains(".") && shortName.split(" ").length > 1)) {
            String[] parts = fullName.split(" ");
            if (parts.length > 1) {
                shortName = parts[0].substring(0, 1).toUpperCase() + ". " + parts[parts.length - 1];
            }
        }
        return shortName;
    }

    private String getTeamName(JsonNode scorer, JsonNode detail, Map<String, String> teamNames) {
        String teamName = scorer.path("team").path("displayName").asText("");
        if (teamName.isEmpty()) {
            String teamId = scorer.path("teamId").asText("");
            if (teamId.isEmpty()) {
                teamId = detail.path("team").path("id").asText("");
            }
            if (!teamId.isEmpty()) {
                teamName = teamNames.getOrDefault(teamId, "");
            }
        }
        return teamName;
    }

    private String fetchImageUrl(String fullName) {
        String imageUrl = CARTOON_MAP.get(fullName);
        if (imageUrl != null) return imageUrl;
        
        imageUrl = imageCache.get(fullName);
        if (imageUrl != null && !imageUrl.isEmpty()) return imageUrl;

        imageUrl = "";
        try {
            String encodedName = java.net.URLEncoder.encode(fullName, "UTF-8").replace("+", "%20");
            
            // First try TheSportsDB
            String sportsDbUrl = "https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=" + encodedName;
            HttpRequest sportsReq = HttpRequest.newBuilder()
                    .uri(URI.create(sportsDbUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("User-Agent", "PorraMundial/1.0")
                    .GET()
                    .build();
            HttpResponse<String> sportsRes = httpClient.send(sportsReq, HttpResponse.BodyHandlers.ofString());
            if (sportsRes.statusCode() == 200) {
                JsonNode sportsRoot = objectMapper.readTree(sportsRes.body());
                JsonNode players = sportsRoot.path("player");
                if (players.isArray() && !players.isEmpty()) {
                    JsonNode p = players.get(0);
                    imageUrl = p.path("strRender").asText("");
                    if (imageUrl.isEmpty()) imageUrl = p.path("strCutout").asText("");
                    if (imageUrl.isEmpty()) imageUrl = p.path("strThumb").asText("");
                }
            }

            // Fallback to Wikipedia
            if (imageUrl.isEmpty()) {
                String wikiUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodedName;
                HttpRequest wikiReq = HttpRequest.newBuilder()
                        .uri(URI.create(wikiUrl))
                        .timeout(Duration.ofSeconds(5))
                        .header("User-Agent", "PorraMundial/1.0")
                        .GET()
                        .build();
                HttpResponse<String> wikiRes = httpClient.send(wikiReq, HttpResponse.BodyHandlers.ofString());
                if (wikiRes.statusCode() == 200) {
                    JsonNode wikiRoot = objectMapper.readTree(wikiRes.body());
                    imageUrl = wikiRoot.path("thumbnail").path("source").asText("");
                }
            }
        } catch (Exception e) {
            log.warn("TopScorerService: image lookup failed for {}: {}", fullName, e.getMessage());
        }
        if (imageUrl != null && !imageUrl.isEmpty()) {
            imageCache.put(fullName, imageUrl);
        }
        return imageUrl != null ? imageUrl : "";
    }

    private List<TopScorerDTO> buildScorersList(Map<String, int[]> playerGoals, Map<String, String> playerShortNames,
                                                       Map<String, String> playerPositions, Map<String, String> playerIds,
                                                       Map<String, String> playerTeams, Map<String, String> playerImages) {
        List<TopScorerDTO> scorers = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : playerGoals.entrySet()) {
            String name = entry.getKey();
            scorers.add(new TopScorerDTO(
                    name,
                    playerShortNames.getOrDefault(name, name),
                    entry.getValue()[0],
                    playerPositions.getOrDefault(name, ""),
                    playerIds.getOrDefault(name, ""),
                    playerTeams.getOrDefault(name, ""),
                    playerImages.getOrDefault(name, "")));
        }
        scorers.sort(Comparator.comparingInt(TopScorerDTO::goals).reversed());
        return scorers;
    }

    public List<TopScorerDTO> getTopScorers() {
        return cachedScorers.get();
    }
}
