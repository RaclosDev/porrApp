package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.config.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.net.http.HttpClient;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * 📡 Servicio de Sincronización — Powered by ESPN API (gratis, sin API key)
 * Cada 30 segundos se conecta al endpoint público de ESPN para obtener
 * resultados en tiempo real del Mundial 2026.
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
    private final WebSocketService webSocketService;
    private final org.springframework.cache.CacheManager cacheManager;
    private final HttpClient httpClient;

    @Value("${app.espn.scoreboard-url}")
    private String espnScoreboardUrl;

    // Date range covering the entire World Cup (group stage through final)
    private static final String WC_DATE_RANGE = "20260611-20260722";

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
     * Full sync: fetches all World Cup data from ESPN and updates our database.
     */
    @CircuitBreaker(name = "sportsApi", fallbackMethod = "syncFallback")
    public Map<String, Object> syncAll() {
        Map<String, Object> result = new LinkedHashMap<>();

        try {
            // Single API call to ESPN — gets ALL matches with scores, teams, dates, status
            String url = espnScoreboardUrl + "?dates=" + WC_DATE_RANGE + "&limit=200";
            
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> response = httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            String json = response.body();

            if (json == null || !json.trim().startsWith("{")) {
                throw new IllegalStateException("ESPN API returned non-JSON response");
            }

            JsonNode root = objectMapper.readTree(json);
            JsonNode events = root.path("events");

            if (!events.isArray()) {
                throw new IllegalStateException("ESPN API: no events array found");
            }

            // Build a map of team name (Spanish) -> Team for fast lookup
            Map<String, Team> nameToTeam = new HashMap<>();
            teamRepository.findAll().forEach(team -> {
                if (team.getName() != null) {
                    nameToTeam.put(team.getName(), team);
                }
                if (team.getNameEn() != null) {
                    nameToTeam.put(team.getNameEn(), team);
                }
                if (team.getExternalId() != null) {
                    nameToTeam.put(team.getExternalId(), team);
                }
            });

            int teamsUpdated = 0;
            int matchesUpdated = 0;
            Map<Long, int[]> teamStats = new HashMap<>(); // teamId -> [pts, diff, gls, mp, fp]

            for (JsonNode event : events) {
                String espnEventId = event.path("id").asText(null);
                if (espnEventId == null) continue;

                JsonNode competition = event.path("competitions").get(0);
                if (competition == null) continue;

                // --- Parse date (ESPN gives UTC ISO dates) ---
                LocalDateTime matchDate = null;
                String dateStr = event.path("date").asText(null);
                if (dateStr != null) {
                    try {
                        ZonedDateTime utc = ZonedDateTime.parse(dateStr);
                        // Convert UTC to Spain timezone (CET/CEST)
                        ZonedDateTime spainTime = utc.withZoneSameInstant(ZoneId.of("Europe/Madrid"));
                        matchDate = spainTime.toLocalDateTime();
                    } catch (Exception e) {
                        log.debug("Could not parse date '{}': {}", dateStr, e.getMessage());
                    }
                }

                // --- Parse status ---
                JsonNode statusNode = competition.path("status").path("type");
                boolean completed = statusNode.path("completed").asBoolean(false);
                String state = statusNode.path("state").asText(""); // "pre", "in", "post"
                boolean isLive = "in".equals(state);
                boolean finished = completed;
                String displayClock = competition.path("status").path("displayClock").asText(null);

                // --- Parse competitors (home & away teams) ---
                JsonNode competitors = competition.path("competitors");
                if (!competitors.isArray() || competitors.size() < 2) continue;

                JsonNode homeComp = null;
                JsonNode awayComp = null;
                for (JsonNode comp : competitors) {
                    if ("home".equals(comp.path("homeAway").asText())) homeComp = comp;
                    else awayComp = comp;
                }
                if (homeComp == null || awayComp == null) continue;

                String homeNameEn = homeComp.path("team").path("displayName").asText(null);
                String awayNameEn = awayComp.path("team").path("displayName").asText(null);
                String homeEspnId = homeComp.path("team").path("id").asText(null);
                String awayEspnId = awayComp.path("team").path("id").asText(null);

                if (homeNameEn == null || awayNameEn == null) continue;

                // Translate ESPN English names to our local Spanish names
                String homeLocalName = Constants.getLocalName(homeNameEn);
                String awayLocalName = Constants.getLocalName(awayNameEn);

                // Find or link teams in our DB
                Team homeTeam = resolveTeam(nameToTeam, homeLocalName, homeNameEn, homeEspnId);
                Team awayTeam = resolveTeam(nameToTeam, awayLocalName, awayNameEn, awayEspnId);

                // Update team English names and external IDs if needed
                if (homeTeam != null) {
                    boolean teamChanged = false;
                    if (homeTeam.getNameEn() == null || !homeTeam.getNameEn().equals(homeNameEn)) {
                        homeTeam.setNameEn(homeNameEn);
                        teamChanged = true;
                    }
                    if (homeTeam.getExternalId() == null || !homeTeam.getExternalId().equals(homeEspnId)) {
                        homeTeam.setExternalId(homeEspnId);
                        teamChanged = true;
                    }
                    if (teamChanged) {
                        teamRepository.save(homeTeam);
                        nameToTeam.put(homeNameEn, homeTeam);
                        nameToTeam.put(homeEspnId, homeTeam);
                        teamsUpdated++;
                    }
                }
                if (awayTeam != null) {
                    boolean teamChanged = false;
                    if (awayTeam.getNameEn() == null || !awayTeam.getNameEn().equals(awayNameEn)) {
                        awayTeam.setNameEn(awayNameEn);
                        teamChanged = true;
                    }
                    if (awayTeam.getExternalId() == null || !awayTeam.getExternalId().equals(awayEspnId)) {
                        awayTeam.setExternalId(awayEspnId);
                        teamChanged = true;
                    }
                    if (teamChanged) {
                        teamRepository.save(awayTeam);
                        nameToTeam.put(awayNameEn, awayTeam);
                        nameToTeam.put(awayEspnId, awayTeam);
                        teamsUpdated++;
                    }
                }

                // --- Parse scores ---
                Integer homeScore = null;
                Integer awayScore = null;
                boolean hasScores = false;

                if (isLive || finished) {
                    try {
                        homeScore = Integer.parseInt(homeComp.path("score").asText(""));
                        awayScore = Integer.parseInt(awayComp.path("score").asText(""));
                        hasScores = true;
                    } catch (NumberFormatException ignored) {}
                }

                // --- Extract group from altGameNote (e.g. "FIFA World Cup, Group F") ---
                String groupName = null;
                String round = "group";
                String altNote = competition.path("altGameNote").asText("");
                if (altNote.contains("Group ")) {
                    groupName = altNote.substring(altNote.indexOf("Group ") + 6).trim();
                    if (groupName.length() > 2) groupName = groupName.substring(0, 1);
                } else if (altNote.contains("Round of 32") || altNote.contains("Round of 16")) {
                    round = "r16";
                } else if (altNote.contains("Quarterfinal")) {
                    round = "qf";
                } else if (altNote.contains("Semifinal")) {
                    round = "sf";
                } else if (altNote.contains("Third")) {
                    round = "third";
                } else if (altNote.contains("Final")) {
                    round = "final";
                }

                // --- Upsert match ---
                boolean updated = false;
                Match match = matchRepository.findByExternalId(espnEventId).orElse(null);
                if (match == null) {
                    match = Match.builder().externalId(espnEventId).build();
                    updated = true;
                }

                // Detect match just finished → trigger scorer refresh
                boolean wasFinished = Boolean.TRUE.equals(match.getFinished());

                if (!Objects.equals(match.getHomeTeam(), homeTeam)) { match.setHomeTeam(homeTeam); updated = true; }
                if (!Objects.equals(match.getAwayTeam(), awayTeam)) { match.setAwayTeam(awayTeam); updated = true; }
                if (!Objects.equals(match.getHomeScore(), homeScore)) { match.setHomeScore(homeScore); updated = true; }
                if (!Objects.equals(match.getAwayScore(), awayScore)) { match.setAwayScore(awayScore); updated = true; }
                if (!Objects.equals(match.getMatchDate(), matchDate)) { match.setMatchDate(matchDate); updated = true; }
                if (!Objects.equals(match.getFinished(), finished)) { match.setFinished(finished); updated = true; }
                if (!Objects.equals(match.getDisplayClock(), displayClock)) { match.setDisplayClock(displayClock); updated = true; }

                if (groupName != null) {
                    if (!Objects.equals(match.getGroupName(), groupName)) {
                        match.setGroupName(groupName);
                        updated = true;
                    }
                }
                if (!Objects.equals(match.getRound(), round)) {
                    match.setRound(round);
                    updated = true;
                }

                if (!wasFinished && finished) {
                    log.info("Match just finished: {} {} - {} {}, triggering scorer refresh",
                            homeLocalName, homeScore, awayScore, awayLocalName);
                    try { topScorerService.refresh(); } catch (Exception ex) { log.warn("Scorer refresh failed: {}", ex.getMessage()); }
                }

                if (updated) {
                    matchRepository.save(match);
                    matchesUpdated++;
                }

                // --- Calculate group standings points and fair play ---
                if (hasScores && homeTeam != null && awayTeam != null && "group".equals(round)
                        && (finished || (isLive && !isStartingSoon(matchDate)))) {
                    teamStats.computeIfAbsent(homeTeam.getId(), k -> new int[5]);
                    teamStats.computeIfAbsent(awayTeam.getId(), k -> new int[5]);

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

                    // Parse Fair Play points (Cards)
                    JsonNode details = competition.path("details");
                    if (details != null && details.isArray()) {
                        Set<String> yellowPlayers = new HashSet<>();
                        for (JsonNode detail : details) {
                            boolean isYellow = detail.path("yellowCard").asBoolean(false);
                            boolean isRed = detail.path("redCard").asBoolean(false);
                            
                            if (isYellow || isRed) {
                                String espnTeamId = detail.path("team").path("id").asText(null);
                                String playerId = null;
                                JsonNode athletes = detail.path("athletesInvolved");
                                if (athletes != null && athletes.isArray() && athletes.size() > 0) {
                                    playerId = athletes.get(0).path("id").asText(null);
                                }
                                
                                int penalty = 0;
                                if (isYellow && !isRed) {
                                    if (playerId != null && yellowPlayers.contains(playerId)) {
                                        // Segunda amarilla (roja indirecta). Ya restamos -1, así que restamos -2 más para que sea -3 en total
                                        penalty = -2;
                                    } else {
                                        // Primera amarilla
                                        penalty = -1;
                                        if (playerId != null) yellowPlayers.add(playerId);
                                    }
                                } else if (isRed) {
                                    // Roja directa (-4 puntos)
                                    penalty = -4;
                                }
                                
                                if (homeTeam.getExternalId() != null && homeTeam.getExternalId().equals(espnTeamId)) {
                                    homeStats[4] += penalty;
                                } else if (awayTeam.getExternalId() != null && awayTeam.getExternalId().equals(espnTeamId)) {
                                    awayStats[4] += penalty;
                                }
                            }
                        }
                    }
                }
            }

            result.put("teamsUpdated", teamsUpdated);
            result.put("matchesUpdated", matchesUpdated);

            // Update group standings
            standingsService.clearAll();
            for (Map.Entry<Long, int[]> entry : teamStats.entrySet()) {
                Team team = teamRepository.findById(entry.getKey()).orElse(null);
                if (team != null) {
                    standingsService.updateStanding(team, team.getGroupName(),
                            entry.getValue()[0], entry.getValue()[1], entry.getValue()[2], entry.getValue()[3], entry.getValue()[4]);
                }
            }

            // Ensure teams with 0 points appear in standings
            teamRepository.findAll().forEach(team -> {
                if (team.getGroupName() != null && !teamStats.containsKey(team.getId())) {
                    standingsService.updateStanding(team, team.getGroupName(), 0, 0, 0, 0, 0);
                }
            });

            result.put("standingsUpdated", teamStats.size());
            result.put("status", "success");
            log.info("ESPN sync completed: {} teams, {} matches updated", teamsUpdated, matchesUpdated);

            if (matchesUpdated > 0 || teamsUpdated > 0) {
                webSocketService.invalidateAndNotify();
            }

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

    /**
     * Resolve a team from our DB by trying: local name, English name, ESPN id
     */
    private Team resolveTeam(Map<String, Team> nameToTeam, String localName, String englishName, String espnId) {
        Team team = nameToTeam.get(localName);
        if (team == null && englishName != null) team = nameToTeam.get(englishName);
        if (team == null && espnId != null) team = nameToTeam.get(espnId);
        // Last resort: try finding in DB by name
        if (team == null && localName != null) {
            team = teamRepository.findByName(localName).orElse(null);
            if (team != null) nameToTeam.put(localName, team);
        }
        return team;
    }

    public Map<String, Object> syncFallback(Exception e) {
        log.warn("Circuit Breaker OPEN or API call failed. Fallback activated. Error: {}", e.getMessage());
        return Map.of(
            "status", "error",
            "message", "Circuit Breaker activado por fallos reiterados en la API. Reintentando más tarde."
        );
    }

    private boolean isStartingSoon(LocalDateTime matchDate) {
        if (matchDate == null) return false;
        long diffMs = java.time.Duration.between(LocalDateTime.now(), matchDate).toMillis();
        return diffMs > 0 && diffMs <= 30 * 60 * 1000;
    }

    public static String getLocalName(String apiName) {
        return Constants.getLocalName(apiName);
    }

    public static Map<String, String> getApiToLocalMap() {
        return Constants.getApiToLocalMap();
    }
}
