package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 📡 Servicio de Sincronización (El "Buscador de Resultados")
 * Esto reemplaza al antiguo `syncWithApi()` que tenías en JavaScript.
 * Cada 15 minutos, este servicio se conecta a hurtadillas a la API oficial (worldcup26.ir),
 * descarga los goles reales que se acaban de marcar, y actualiza nuestra Base de Datos.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyncService {

    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final StandingsService standingsService;
    private final TopScorerService topScorerService;
    private final ObjectMapper objectMapper;

    @Value("${app.worldcup-api.teams-url}")
    private String teamsApiUrl;

    @Value("${app.worldcup-api.games-url}")
    private String gamesApiUrl;

    // Stadium timezone offsets to Spain (CEST / UTC+2)
    private static final Map<String, Integer> STADIUM_OFFSETS = Map.ofEntries(
            Map.entry("14", 9), Map.entry("8", 6), Map.entry("13", 9),
            Map.entry("15", 9), Map.entry("3", 8), Map.entry("1", 8),
            Map.entry("2", 8), Map.entry("5", 7), Map.entry("16", 9),
            Map.entry("7", 6), Map.entry("9", 6), Map.entry("6", 7),
            Map.entry("10", 6), Map.entry("4", 7), Map.entry("11", 6),
            Map.entry("12", 6)
    );

    // API team name -> Local Spanish name mapping
    private static final Map<String, String> API_TO_LOCAL = new LinkedHashMap<>();
    static {
        API_TO_LOCAL.put("Mexico", "México");
        API_TO_LOCAL.put("South Africa", "Sudáfrica");
        API_TO_LOCAL.put("South Korea", "Corea del Sur");
        API_TO_LOCAL.put("Czech Republic", "Chequia");
        API_TO_LOCAL.put("Canada", "Canadá");
        API_TO_LOCAL.put("Bosnia and Herzegovina", "Bosnia y Her.");
        API_TO_LOCAL.put("Qatar", "Catar");
        API_TO_LOCAL.put("Switzerland", "Suiza");
        API_TO_LOCAL.put("Brazil", "Brasil");
        API_TO_LOCAL.put("Morocco", "Marruecos");
        API_TO_LOCAL.put("Haiti", "Haití");
        API_TO_LOCAL.put("Scotland", "Escocia");
        API_TO_LOCAL.put("United States", "EEUU");
        API_TO_LOCAL.put("Paraguay", "Paraguay");
        API_TO_LOCAL.put("Australia", "Australia");
        API_TO_LOCAL.put("Turkey", "Turquía");
        API_TO_LOCAL.put("Germany", "Alemania");
        API_TO_LOCAL.put("Curacao", "Curaçao");
        API_TO_LOCAL.put("Ivory Coast", "Costa de Marfil");
        API_TO_LOCAL.put("Ecuador", "Ecuador");
        API_TO_LOCAL.put("Netherlands", "Países Bajos");
        API_TO_LOCAL.put("Japan", "Japón");
        API_TO_LOCAL.put("Sweden", "Suecia");
        API_TO_LOCAL.put("Tunisia", "Túnez");
        API_TO_LOCAL.put("Belgium", "Bélgica");
        API_TO_LOCAL.put("Egypt", "Egipto");
        API_TO_LOCAL.put("Iran", "Irán");
        API_TO_LOCAL.put("New Zealand", "Nueva Zelanda");
        API_TO_LOCAL.put("Spain", "España");
        API_TO_LOCAL.put("Cape Verde", "Cabo Verde");
        API_TO_LOCAL.put("Saudi Arabia", "Arabia Saudí");
        API_TO_LOCAL.put("Uruguay", "Uruguay");
        API_TO_LOCAL.put("France", "Francia");
        API_TO_LOCAL.put("Senegal", "Senegal");
        API_TO_LOCAL.put("Iraq", "Irak");
        API_TO_LOCAL.put("Norway", "Noruega");
        API_TO_LOCAL.put("Argentina", "Argentina");
        API_TO_LOCAL.put("Algeria", "Argelia");
        API_TO_LOCAL.put("Austria", "Austria");
        API_TO_LOCAL.put("Jordan", "Jordania");
        API_TO_LOCAL.put("Portugal", "Portugal");
        API_TO_LOCAL.put("DR Congo", "RD Congo");
        API_TO_LOCAL.put("Democratic Republic of the Congo", "RD Congo");
        API_TO_LOCAL.put("Uzbekistan", "Uzbekistán");
        API_TO_LOCAL.put("Colombia", "Colombia");
        API_TO_LOCAL.put("England", "Inglaterra");
        API_TO_LOCAL.put("Croatia", "Croacia");
        API_TO_LOCAL.put("Ghana", "Ghana");
        API_TO_LOCAL.put("Panama", "Panamá");
    }

    /**
     * Scheduled sync every 30 seconds (configurable in application.properties).
     */
    @Scheduled(fixedDelayString = "${app.sync.interval-ms}")
    public void scheduledSync() {
        try {
            syncAll();
        } catch (Exception e) {
            log.warn("Scheduled sync failed: {}", e.getMessage());
        }
    }

    /**
     * Full sync: teams + games + standings.
     */
    public Map<String, Object> syncAll() {
        Map<String, Object> result = new LinkedHashMap<>();
        
        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
                    .connectTimeout(java.time.Duration.ofSeconds(10))
                    .build();

            // 1. Sync teams
            java.net.http.HttpRequest teamsRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(teamsApiUrl + "?_cb=" + System.currentTimeMillis()))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            
            java.net.http.HttpResponse<String> teamsResponse = client.send(teamsRequest, java.net.http.HttpResponse.BodyHandlers.ofString());
            String teamsJson = teamsResponse.body();
            
            if (teamsJson == null || (!teamsJson.trim().startsWith("{") && !teamsJson.trim().startsWith("["))) {
                throw new IllegalStateException("API teams returned non-JSON response (posible bloqueo de Cloudflare): " + 
                    (teamsJson != null && teamsJson.length() > 50 ? teamsJson.substring(0, 50).replace('\n', ' ') : teamsJson));
            }

            JsonNode teamsRoot = objectMapper.readTree(teamsJson);
            JsonNode teamsArray = teamsRoot.get("teams");

            if (teamsArray != null && teamsArray.isArray()) {
                int teamsUpdated = 0;
                for (JsonNode t : teamsArray) {
                    String extId = t.get("id").asText();
                    String nameEn = t.get("name_en").asText();

                    Team team = teamRepository.findByExternalId(extId).orElse(null);
                    
                    if (team == null) {
                        // First time syncing this team, find by local name
                        String localName = API_TO_LOCAL.getOrDefault(nameEn, nameEn);
                        team = teamRepository.findByName(localName).orElse(null);
                    }
                    
                    if (team != null) {
                        boolean updated = false;
                        if (team.getExternalId() == null || !team.getExternalId().equals(extId)) {
                            team.setExternalId(extId);
                            updated = true;
                        }
                        if (team.getNameEn() == null || !team.getNameEn().equals(nameEn)) {
                            team.setNameEn(nameEn);
                            updated = true;
                        }
                        if (updated) {
                            teamRepository.save(team);
                            teamsUpdated++;
                        }
                    }
                }
                result.put("teamsUpdated", teamsUpdated);
            }

            // 2. Sync games
            java.net.http.HttpRequest gamesRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(gamesApiUrl + "?_cb=" + System.currentTimeMillis()))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            
            java.net.http.HttpResponse<String> gamesResponse = client.send(gamesRequest, java.net.http.HttpResponse.BodyHandlers.ofString());
            String gamesJson = gamesResponse.body();
            
            if (gamesJson == null || (!gamesJson.trim().startsWith("{") && !gamesJson.trim().startsWith("["))) {
                throw new IllegalStateException("API games returned non-JSON response (posible bloqueo de Cloudflare): " + 
                    (gamesJson != null && gamesJson.length() > 50 ? gamesJson.substring(0, 50).replace('\n', ' ') : gamesJson));
            }

            JsonNode gamesRoot = objectMapper.readTree(gamesJson);
            JsonNode gamesArray = gamesRoot.get("games");

            // Build a map of externalId -> Team for fast lookup
            Map<String, Team> extIdToTeam = new HashMap<>();
            teamRepository.findAll().forEach(team -> {
                if (team.getExternalId() != null) {
                    extIdToTeam.put(team.getExternalId(), team);
                }
                // Also map by English name for flexibility
                if (team.getNameEn() != null) {
                    extIdToTeam.put(team.getNameEn(), team);
                }
            });

            // Points calculation accumulators
            Map<Long, int[]> teamStats = new HashMap<>(); // teamId -> [pts, diff, gls, mp]

            if (gamesArray != null && gamesArray.isArray()) {
                int matchesUpdated = 0;
                for (JsonNode g : gamesArray) {
                    String gameExtId = g.has("id") ? g.get("id").asText() : null;
                    if (gameExtId == null) continue;

                    String homeTeamId = g.has("home_team_id") ? g.get("home_team_id").asText() : null;
                    String awayTeamId = g.has("away_team_id") ? g.get("away_team_id").asText() : null;

                    Team homeTeam = homeTeamId != null ? extIdToTeam.get(homeTeamId) : null;
                    Team awayTeam = awayTeamId != null ? extIdToTeam.get(awayTeamId) : null;

                    // Parse date with stadium timezone conversion
                    LocalDateTime matchDate = null;
                    if (g.has("local_date") && !g.get("local_date").isNull()) {
                        try {
                            String dateStr = g.get("local_date").asText();
                            matchDate = LocalDateTime.parse(dateStr, DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm"));
                            String stadiumId = g.has("stadium_id") ? g.get("stadium_id").asText() : "";
                            int offset = STADIUM_OFFSETS.getOrDefault(stadiumId, 0);
                            matchDate = matchDate.plusHours(offset);
                        } catch (Exception e) {
                            // Try ISO format
                            try {
                                matchDate = LocalDateTime.parse(g.get("local_date").asText());
                            } catch (Exception ignored) {}
                        }
                    }

                    // Parse scores
                    Integer homeScore = null;
                    Integer awayScore = null;
                    boolean hasScores = false;

                    if (g.has("home_score") && !g.get("home_score").isNull() && !g.get("home_score").asText().isEmpty() && !g.get("home_score").asText().equals("null")) {
                        try {
                            homeScore = Integer.parseInt(g.get("home_score").asText());
                            awayScore = Integer.parseInt(g.get("away_score").asText());
                            hasScores = true;
                        } catch (NumberFormatException ignored) {}
                    }

                    boolean finished = g.has("finished") && "TRUE".equals(g.get("finished").asText());

                    // Determine if live
                    boolean isLive = false;
                    if (!finished && matchDate != null) {
                        long diffMs = java.time.Duration.between(LocalDateTime.now(), matchDate).toMillis();
                        if (diffMs <= 30 * 60 * 1000) {
                            isLive = true;
                        }
                    }

                    // Upsert match
                    Match match = matchRepository.findByExternalId(gameExtId)
                            .orElse(Match.builder().externalId(gameExtId).build());

                    // Detect match just finished → trigger scorer refresh
                    boolean wasFinished = Boolean.TRUE.equals(match.getFinished());

                    match.setHomeTeam(homeTeam);
                    match.setAwayTeam(awayTeam);
                    match.setHomeScore(homeScore);
                    match.setAwayScore(awayScore);
                    match.setMatchDate(matchDate);
                    match.setFinished(finished);
                    match.setStadiumId(g.has("stadium_id") ? g.get("stadium_id").asText() : null);

                    if (!wasFinished && finished) {
                        log.info("Match just finished, triggering scorer refresh");
                        try { topScorerService.refresh(); } catch (Exception ex) { log.warn("Scorer refresh failed: {}", ex.getMessage()); }
                    }

                    // Determine group from teams
                    if (homeTeam != null && homeTeam.getGroupName() != null) {
                        match.setGroupName(homeTeam.getGroupName());
                        match.setRound("group");
                    }

                    matchRepository.save(match);
                    matchesUpdated++;

                    // Calculate group standings points
                    if (hasScores && homeTeam != null && awayTeam != null && (finished || (isLive && !isStartingSoon(matchDate)))) {
                        teamStats.computeIfAbsent(homeTeam.getId(), k -> new int[4]);
                        teamStats.computeIfAbsent(awayTeam.getId(), k -> new int[4]);

                        int[] homeStats = teamStats.get(homeTeam.getId());
                        int[] awayStats = teamStats.get(awayTeam.getId());

                        homeStats[3]++; // mp
                        awayStats[3]++;
                        homeStats[2] += homeScore; // gls
                        awayStats[2] += awayScore;
                        homeStats[1] += (homeScore - awayScore); // diff
                        awayStats[1] += (awayScore - homeScore);

                        if (homeScore > awayScore) {
                            homeStats[0] += 3; // pts
                        } else if (awayScore > homeScore) {
                            awayStats[0] += 3;
                        } else {
                            homeStats[0] += 1;
                            awayStats[0] += 1;
                        }
                    }
                }
                result.put("matchesUpdated", matchesUpdated);
            }

            // 3. Update group standings
            standingsService.clearAll();
            for (Map.Entry<Long, int[]> entry : teamStats.entrySet()) {
                Team team = teamRepository.findById(entry.getKey()).orElse(null);
                if (team != null && team.getGroupName() != null) {
                    int[] s = entry.getValue();
                    standingsService.updateStanding(team, team.getGroupName(), s[0], s[1], s[2], s[3]);
                }
            }

            // Also ensure teams with 0 points appear in standings
            teamRepository.findAll().forEach(team -> {
                if (team.getGroupName() != null && !teamStats.containsKey(team.getId())) {
                    standingsService.updateStanding(team, team.getGroupName(), 0, 0, 0, 0);
                }
            });

            result.put("standingsUpdated", teamStats.size());
            result.put("status", "success");
            log.info("Sync completed: {} teams, {} matches updated", result.get("teamsUpdated"), result.get("matchesUpdated"));

        } catch (IllegalStateException e) {
            log.warn("Sync paused: {}", e.getMessage());
            result.put("status", "error");
            result.put("message", e.getMessage());
        } catch (Exception e) {
            log.error("Sync failed: {}", e.getMessage());
            result.put("status", "error");
            result.put("message", e.getMessage());
        }

        return result;
    }

    private boolean isStartingSoon(LocalDateTime matchDate) {
        if (matchDate == null) return false;
        long diffMs = java.time.Duration.between(LocalDateTime.now(), matchDate).toMillis();
        return diffMs > 0 && diffMs <= 30 * 60 * 1000;
    }

    public static String getLocalName(String apiName) {
        return API_TO_LOCAL.getOrDefault(apiName, apiName);
    }

    public static Map<String, String> getApiToLocalMap() {
        return Collections.unmodifiableMap(API_TO_LOCAL);
    }
}
