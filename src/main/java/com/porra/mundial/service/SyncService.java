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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * 📡 Servicio de Sincronización Automática con API Externa (ESPN).
 * Mantiene la base de datos de la Porra actualizada con resultados y horarios reales.
 * Se ejecuta automáticamente (Cron job en background).
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
    private final HttpClient httpClient;

    @Value("${app.espn.scoreboard-url}")
    private String espnScoreboardUrl;

    private static final String WC_DATE_RANGE = "20260611-20260722";
    private static final ZoneId SPAIN_ZONE = ZoneId.of("Europe/Madrid");

    /**
     * Tarea programada que se dispara cíclicamente según app.sync.interval-ms.
     * Cero impacto al usuario (completamente en background).
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
     * Hace el Fetch a la API de ESPN. Está protegido por un Circuit Breaker
     * para que si ESPN se cae o bannea nuestra IP, el servidor no colapse.
     */
    @CircuitBreaker(name = "sportsApi", fallbackMethod = "syncFallback")
    public Map<String, Object> syncAll() {
        Map<String, Object> result = new LinkedHashMap<>();

        try {
            JsonNode events = fetchEspnEvents();
            Map<String, Team> nameToTeamCache = buildTeamCache();
            
            SyncContext context = new SyncContext();

            for (JsonNode event : events) {
                processEvent(event, nameToTeamCache, context);
            }

            // Una vez parseados todos los partidos, reconstruye la clasificación entera.
            updateStandings(context.teamStats);

            result.put("teamsUpdated", context.teamsUpdated);
            result.put("matchesUpdated", context.matchesUpdated);
            result.put("standingsUpdated", context.teamStats.size());
            result.put("status", "success");
            
            log.info("ESPN sync completed: {} teams, {} matches updated", context.teamsUpdated, context.matchesUpdated);

            // Si ha habido algún cambio real en base de datos, grita al frontend.
            if (context.matchesUpdated > 0 || context.teamsUpdated > 0) {
                webSocketService.invalidateAndNotify();
            }
        } catch (Exception e) {
            log.error("Sync failed: {}", e.getMessage(), e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }

        return result;
    }

    private JsonNode fetchEspnEvents() throws Exception {
        String url = espnScoreboardUrl + "?dates=" + WC_DATE_RANGE + "&limit=200";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String json = response.body();

        if (json == null || !json.trim().startsWith("{")) {
            throw new IllegalStateException("ESPN API returned non-JSON response");
        }

        JsonNode root = objectMapper.readTree(json);
        JsonNode events = root.path("events");

        if (!events.isArray()) {
            throw new IllegalStateException("ESPN API: no events array found");
        }
        return events;
    }

    private Map<String, Team> buildTeamCache() {
        Map<String, Team> cache = new HashMap<>();
        teamRepository.findAll().forEach(team -> {
            if (team.getName() != null) cache.put(team.getName(), team);
            if (team.getNameEn() != null) cache.put(team.getNameEn(), team);
            if (team.getExternalId() != null) cache.put(team.getExternalId(), team);
        });
        return cache;
    }

    private void processEvent(JsonNode event, Map<String, Team> nameToTeamCache, SyncContext context) {
        String espnEventId = event.path("id").asText(null);
        if (espnEventId == null) return;

        JsonNode competition = event.path("competitions").get(0);
        if (competition == null) return;

        LocalDateTime matchDate = parseDate(event.path("date").asText(null));
        MatchStatus status = parseStatus(competition);
        
        JsonNode competitors = competition.path("competitors");
        if (!competitors.isArray() || competitors.size() < 2) return;

        CompetitorNode homeComp = extractCompetitor(competitors, "home");
        CompetitorNode awayComp = extractCompetitor(competitors, "away");
        if (homeComp == null || awayComp == null) return;

        Team homeTeam = resolveAndUpdateTeam(homeComp, nameToTeamCache, context);
        Team awayTeam = resolveAndUpdateTeam(awayComp, nameToTeamCache, context);

        if (homeTeam == null || awayTeam == null) return;

        MatchScores scores = parseScoresAndWinner(homeComp, awayComp, homeTeam, awayTeam, status);
        MatchMetadata metadata = parseMetadata(competition);

        upsertMatch(espnEventId, homeTeam, awayTeam, scores, matchDate, status, metadata, context);

        if (scores.hasScores && "group".equals(metadata.round) && (status.finished || (status.isLive && !isStartingSoon(matchDate)))) {
            updateMatchStats(competition, homeTeam, awayTeam, scores, context.teamStats);
        }
    }

    private LocalDateTime parseDate(String dateStr) {
        if (dateStr == null) return null;
        try {
            return ZonedDateTime.parse(dateStr).withZoneSameInstant(SPAIN_ZONE).toLocalDateTime();
        } catch (Exception e) {
            log.debug("Could not parse date '{}': {}", dateStr, e.getMessage());
            return null;
        }
    }

    private MatchStatus parseStatus(JsonNode competition) {
        JsonNode statusNode = competition.path("status").path("type");
        boolean completed = statusNode.path("completed").asBoolean(false);
        String state = statusNode.path("state").asText("");
        String displayClock = competition.path("status").path("displayClock").asText(null);
        return new MatchStatus("in".equals(state), completed, displayClock);
    }

    private CompetitorNode extractCompetitor(JsonNode competitors, String type) {
        for (JsonNode comp : competitors) {
            if (type.equals(comp.path("homeAway").asText())) {
                String name = comp.path("team").path("displayName").asText(null);
                String id = comp.path("team").path("id").asText(null);
                return (name != null && id != null) ? new CompetitorNode(comp, name, id) : null;
            }
        }
        return null;
    }

    private Team resolveAndUpdateTeam(CompetitorNode comp, Map<String, Team> cache, SyncContext context) {
        String localName = Constants.getLocalName(comp.nameEn);
        Team team = resolveTeam(cache, localName, comp.nameEn, comp.espnId);
        
        if (team != null) {
            boolean changed = false;
            if (!Objects.equals(team.getNameEn(), comp.nameEn)) {
                team.setNameEn(comp.nameEn);
                changed = true;
            }
            if (!Objects.equals(team.getExternalId(), comp.espnId)) {
                team.setExternalId(comp.espnId);
                changed = true;
            }
            if (changed) {
                teamRepository.save(team);
                cache.put(comp.nameEn, team);
                cache.put(comp.espnId, team);
                context.teamsUpdated++;
            }
        }
        return team;
    }

    private Team resolveTeam(Map<String, Team> cache, String localName, String englishName, String espnId) {
        if (cache.containsKey(localName)) return cache.get(localName);
        if (cache.containsKey(englishName)) return cache.get(englishName);
        if (cache.containsKey(espnId)) return cache.get(espnId);
        
        if (localName != null) {
            Team team = teamRepository.findByName(localName).orElse(null);
            if (team != null) {
                cache.put(localName, team);
                return team;
            }
        }
        return null;
    }

    private MatchScores parseScoresAndWinner(CompetitorNode home, CompetitorNode away, Team homeTeam, Team awayTeam, MatchStatus status) {
        MatchScores scores = new MatchScores();
        if (status.isLive || status.finished) {
            try {
                scores.home = Integer.parseInt(home.node.path("score").asText(""));
                scores.away = Integer.parseInt(away.node.path("score").asText(""));
                scores.hasScores = true;
            } catch (NumberFormatException ignored) {}
            
            boolean homeWinner = home.node.path("advance").asBoolean(home.node.path("winner").asBoolean(false));
            boolean awayWinner = away.node.path("advance").asBoolean(away.node.path("winner").asBoolean(false));
            
            if (homeWinner && !awayWinner) scores.winner = homeTeam;
            else if (awayWinner && !homeWinner) scores.winner = awayTeam;
        }
        return scores;
    }

    private MatchMetadata parseMetadata(JsonNode competition) {
        String altNote = competition.path("altGameNote").asText("");
        String group = null, round = "group";
        
        if (altNote.contains("Group ")) {
            group = altNote.substring(altNote.indexOf("Group ") + 6).trim();
            if (group.length() > 2) group = group.substring(0, 1);
        } else if (altNote.contains("Round of 32") || altNote.contains("Round of 16")) round = "r16";
        else if (altNote.contains("Quarterfinal")) round = "qf";
        else if (altNote.contains("Semifinal")) round = "sf";
        else if (altNote.contains("Third")) round = "third";
        else if (altNote.contains("Final")) round = "final";
        
        return new MatchMetadata(group, round);
    }

    private void upsertMatch(String espnEventId, Team home, Team away, MatchScores scores, 
                             LocalDateTime date, MatchStatus status, MatchMetadata meta, SyncContext context) {
        Match match = matchRepository.findByExternalId(espnEventId)
                .orElseGet(() -> Match.builder().externalId(espnEventId).build());

        boolean wasFinished = Boolean.TRUE.equals(match.getFinished());
        boolean updated = match.getId() == null;

        if (updateIfChanged(match.getHomeTeam(), home, match::setHomeTeam)) updated = true;
        if (updateIfChanged(match.getAwayTeam(), away, match::setAwayTeam)) updated = true;
        if (updateIfChanged(match.getWinnerTeam(), scores.winner, match::setWinnerTeam)) updated = true;
        if (updateIfChanged(match.getHomeScore(), scores.home, match::setHomeScore)) updated = true;
        if (updateIfChanged(match.getAwayScore(), scores.away, match::setAwayScore)) updated = true;
        if (updateIfChanged(match.getMatchDate(), date, match::setMatchDate)) updated = true;
        if (updateIfChanged(match.getFinished(), status.finished, match::setFinished)) updated = true;
        if (updateIfChanged(match.getDisplayClock(), status.displayClock, match::setDisplayClock)) updated = true;
        if (updateIfChanged(match.getGroupName(), meta.groupName, match::setGroupName)) updated = true;
        if (updateIfChanged(match.getRound(), meta.round, match::setRound)) updated = true;

        // Trigger manual Pichichi refresh when a match finishes (don't wait 30 minutes)
        if (!wasFinished && status.finished) {
            log.info("Match just finished: {} - {}, triggering scorer refresh", home.getName(), away.getName());
            try { topScorerService.refresh(); } catch (Exception ex) { log.warn("Scorer refresh failed", ex); }
        }

        if (updated) {
            matchRepository.save(match);
            context.matchesUpdated++;
        }
    }

    private <T> boolean updateIfChanged(T current, T newValue, java.util.function.Consumer<T> setter) {
        if (!Objects.equals(current, newValue)) {
            setter.accept(newValue);
            return true;
        }
        return false;
    }

    private void updateMatchStats(JsonNode competition, Team home, Team away, MatchScores scores, Map<Long, int[]> teamStats) {
        int[] homeStats = teamStats.computeIfAbsent(home.getId(), k -> new int[5]);
        int[] awayStats = teamStats.computeIfAbsent(away.getId(), k -> new int[5]);

        homeStats[3]++; awayStats[3]++;
        homeStats[2] += scores.home; awayStats[2] += scores.away;
        homeStats[1] += (scores.home - scores.away); awayStats[1] += (scores.away - scores.home);

        if (scores.home > scores.away) homeStats[0] += 3;
        else if (scores.away > scores.home) awayStats[0] += 3;
        else { homeStats[0] += 1; awayStats[0] += 1; }

        calculateFairPlay(competition, home, away, homeStats, awayStats);
    }

    /**
     * Calcula los puntos de Fair Play (tarjetas) desde el JSON de la API.
     * Tarjeta Amarilla = -1. Roja Directa = -4. Doble Amarilla = -3.
     */
    private void calculateFairPlay(JsonNode competition, Team home, Team away, int[] homeStats, int[] awayStats) {
        JsonNode details = competition.path("details");
        if (details == null || !details.isArray()) return;

        Set<String> yellowPlayers = new HashSet<>();
        for (JsonNode detail : details) {
            boolean isYellow = detail.path("yellowCard").asBoolean(false);
            boolean isRed = detail.path("redCard").asBoolean(false);
            
            if (!isYellow && !isRed) continue;

            String espnTeamId = detail.path("team").path("id").asText(null);
            String playerId = extractPlayerId(detail.path("athletesInvolved"));
            
            int penalty = calculateCardPenalty(isYellow, isRed, playerId, yellowPlayers);
            
            if (Objects.equals(home.getExternalId(), espnTeamId)) homeStats[4] += penalty;
            else if (Objects.equals(away.getExternalId(), espnTeamId)) awayStats[4] += penalty;
        }
    }

    private String extractPlayerId(JsonNode athletes) {
        return (athletes != null && athletes.isArray() && athletes.size() > 0) 
            ? athletes.get(0).path("id").asText(null) : null;
    }

    private int calculateCardPenalty(boolean isYellow, boolean isRed, String playerId, Set<String> yellowPlayers) {
        if (isRed) return -4;
        if (isYellow) {
            if (playerId != null && !yellowPlayers.add(playerId)) return -2;
            return -1;
        }
        return 0;
    }

    private void updateStandings(Map<Long, int[]> teamStats) {
        standingsService.clearAll();
        for (Map.Entry<Long, int[]> entry : teamStats.entrySet()) {
            teamRepository.findById(entry.getKey()).ifPresent(team -> 
                standingsService.updateStanding(team, team.getGroupName(),
                        entry.getValue()[0], entry.getValue()[1], entry.getValue()[2], entry.getValue()[3], entry.getValue()[4])
            );
        }

        teamRepository.findAll().forEach(team -> {
            if (team.getGroupName() != null && !teamStats.containsKey(team.getId())) {
                standingsService.updateStanding(team, team.getGroupName(), 0, 0, 0, 0, 0);
            }
        });
    }

    /**
     * Fallback method llamado si ESPN falla repetidas veces.
     */
    public Map<String, Object> syncFallback(Exception e) {
        log.warn("Circuit Breaker OPEN or API call failed. Fallback activated. Error: {}", e.getMessage());
        return Map.of("status", "error", "message", "Circuit Breaker activado por fallos reiterados en la API. Reintentando más tarde.");
    }

    private boolean isStartingSoon(LocalDateTime matchDate) {
        if (matchDate == null) return false;
        long diffMs = Duration.between(LocalDateTime.now(), matchDate).toMillis();
        return diffMs > 0 && diffMs <= 30 * 60 * 1000;
    }

    // Helper classes
    private static class SyncContext {
        int teamsUpdated = 0;
        int matchesUpdated = 0;
        Map<Long, int[]> teamStats = new HashMap<>();
    }

    private record MatchStatus(boolean isLive, boolean finished, String displayClock) {}
    private record CompetitorNode(JsonNode node, String nameEn, String espnId) {}
    private record MatchMetadata(String groupName, String round) {}
    private static class MatchScores {
        Integer home, away;
        boolean hasScores;
        Team winner;
    }
}
