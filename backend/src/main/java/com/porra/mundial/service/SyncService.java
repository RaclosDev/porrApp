package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.SyncAuditLog;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.SyncAuditLogRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.config.Constants;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.sports.SportsDataProviderRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de Sincronización Automática con Proveedores Deportivos (Fase 4).
 * Soporta múltiples competiciones y adaptadores (ESPN, API-Football),
 * con trazabilidad en auditoría, estados canónicos normalizados y recálculo automático.
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
    private final com.porra.mundial.repository.CompetitionRepository competitionRepository;
    private final SportsDataProviderRegistry sportsDataProviderRegistry;
    private final SyncAuditLogRepository syncAuditLogRepository;
    private final MatchPredictionService matchPredictionService;

    private static final String WC_DATE_RANGE = "20260611-20260722";
    private static final ZoneId SPAIN_ZONE = ZoneId.of("Europe/Madrid");
    private volatile LocalDateTime lastSyncTime;
    private volatile String lastSyncStatus = "INITIALIZING";
    private volatile int lastMatchesUpdated = 0;
    private volatile int lastTeamsUpdated = 0;
    private volatile String lastErrorMessage;

    public LocalDateTime getLastSyncTime() { return lastSyncTime; }
    public String getLastSyncStatus() { return lastSyncStatus; }
    public int getLastMatchesUpdated() { return lastMatchesUpdated; }
    public int getLastTeamsUpdated() { return lastTeamsUpdated; }
    public String getLastErrorMessage() { return lastErrorMessage; }

    /**
     * Tarea programada cíclica en background.
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
     * Sincroniza todas las competiciones activas o la competición por defecto.
     */
    @CircuitBreaker(name = "sportsApi", fallbackMethod = "syncFallback")
    public Map<String, Object> syncAll() {
        return syncCompetition(null);
    }

    /**
     * Sincroniza una competición específica seleccionando el proveedor deportivo adecuado.
     */
    public Map<String, Object> syncCompetition(Long competitionId) {
        Map<String, Object> result = new LinkedHashMap<>();
        long startTime = System.currentTimeMillis();

        Competition targetComp = null;
        if (competitionId != null) {
            targetComp = competitionRepository.findById(competitionId).orElse(null);
        }
        if (targetComp == null) {
            targetComp = competitionRepository.findByName("FIFA World Cup 2026")
                    .or(() -> competitionRepository.findAll().stream().findFirst())
                    .orElse(null);
        }

        String compName = targetComp != null ? targetComp.getName() : "FIFA World Cup 2026";
        SportsDataProvider provider = sportsDataProviderRegistry.getProviderForCompetition(compName);

        try {
            String slug = targetComp != null && targetComp.getExternalId() != null ? targetComp.getExternalId() : "fifa.world";
            String dateParam = "fifa.world".equalsIgnoreCase(slug) ? WC_DATE_RANGE : LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            JsonNode events = provider.fetchScoreboardEvents(slug, dateParam);
            Map<String, Team> nameToTeamCache = buildTeamCache();

            SyncContext context = new SyncContext();
            context.competition = targetComp;

            if (events != null && events.isArray()) {
                for (JsonNode event : events) {
                    processEvent(event, nameToTeamCache, context);
                }
            }

            propagateKnockoutWinners(context);
            updateStandings(context.teamStats);

            long duration = System.currentTimeMillis() - startTime;
            result.put("teamsUpdated", context.teamsUpdated);
            result.put("matchesUpdated", context.matchesUpdated);
            result.put("standingsUpdated", context.teamStats.size());
            result.put("provider", provider.getProviderName());
            result.put("status", "success");
            result.put("durationMs", duration);

            lastSyncTime = LocalDateTime.now();
            lastSyncStatus = "success";
            lastMatchesUpdated = context.matchesUpdated;
            lastTeamsUpdated = context.teamsUpdated;
            lastErrorMessage = null;
            log.info("{} sync completed: {} teams, {} matches updated in {} ms",
                    provider.getProviderName(), context.teamsUpdated, context.matchesUpdated, duration);

            syncAuditLogRepository.save(SyncAuditLog.builder()
                    .provider(provider.getProviderName())
                    .competition(targetComp)
                    .status("SUCCESS")
                    .matchesUpdated(context.matchesUpdated)
                    .teamsUpdated(context.teamsUpdated)
                    .durationMs(duration)
                    .syncedAt(lastSyncTime)
                    .build());

            if (context.matchesUpdated > 0 || context.teamsUpdated > 0) {
                webSocketService.invalidateAndNotify();
            }
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            lastSyncTime = LocalDateTime.now();
            lastSyncStatus = "error";
            lastErrorMessage = e.getMessage();
            log.error("Sync failed for {}: {}", provider.getProviderName(), e.getMessage(), e);
            result.put("status", "error");
            result.put("provider", provider.getProviderName());
            result.put("message", e.getMessage());
            result.put("durationMs", duration);

            try {
                syncAuditLogRepository.save(SyncAuditLog.builder()
                        .provider(provider.getProviderName())
                        .competition(targetComp)
                        .status("ERROR")
                        .durationMs(duration)
                        .errorMessage(e.getMessage())
                        .syncedAt(lastSyncTime)
                        .build());
            } catch (Exception auditEx) {
                log.warn("Could not save sync audit log", auditEx);
            }
        }

        return result;
    }

    /**
     * Resumen de salud y trazabilidad de sincronización para el panel de administración.
     */
    public Map<String, Object> getSyncOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("status", lastSyncStatus);
        overview.put("lastSyncTime", lastSyncTime);
        overview.put("matchesUpdated", lastMatchesUpdated);
        overview.put("teamsUpdated", lastTeamsUpdated);
        overview.put("lastError", lastErrorMessage);
        overview.put("defaultProvider", sportsDataProviderRegistry.getProviderForCompetition("fifa").getProviderName());
        overview.put("availableProviders", sportsDataProviderRegistry.getAllProviders().stream()
                .map(SportsDataProvider::getProviderName)
                .collect(Collectors.toList()));
        overview.put("recentLogs", syncAuditLogRepository.findTop20ByOrderBySyncedAtDesc());
        return overview;
    }

    /**
     * Corrección manual auditada de un partido por un administrador.
     */
    @Transactional
    public Match overrideMatchResult(Long matchId, Integer homeScore, Integer awayScore, MatchStatusNormalized status, String adminUser) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Partido no encontrado con ID: " + matchId));

        match.setHomeScore(homeScore);
        match.setAwayScore(awayScore);
        MatchStatusNormalized finalStatus = status != null ? status : MatchStatusNormalized.FINISHED;
        match.setStatus(finalStatus);
        match.setFinished(finalStatus.isFinished());

        if (homeScore != null && awayScore != null) {
            if (homeScore > awayScore) match.setWinnerTeam(match.getHomeTeam());
            else if (awayScore > homeScore) match.setWinnerTeam(match.getAwayTeam());
            else match.setWinnerTeam(null);
        }

        Match saved = matchRepository.save(match);
        try {
            matchPredictionService.evaluatePredictionsForMatch(saved);
        } catch (Exception e) {
            log.warn("Evaluation failed during manual override", e);
        }

        webSocketService.broadcastMatchScore(
                saved.getId(),
                saved.getHomeTeam() != null ? saved.getHomeTeam().getName() : "Local",
                saved.getAwayTeam() != null ? saved.getAwayTeam().getName() : "Visitante",
                saved.getHomeScore(),
                saved.getAwayScore(),
                saved.getStatus().name()
        );
        webSocketService.invalidateAndNotify();

        log.info("Admin {} manually overrode result for match {} ({} {} - {} {}) with status {}",
                adminUser, matchId,
                saved.getHomeTeam() != null ? saved.getHomeTeam().getName() : "",
                homeScore, awayScore,
                saved.getAwayTeam() != null ? saved.getAwayTeam().getName() : "",
                finalStatus);

        return saved;
    }

    /**
     * Importa el catálogo completo de equipos (con escudos oficiales) y los partidos próximos de una competición vía ESPN.
     */
    @Transactional
    public Map<String, Object> importCompetitionData(Long competitionId) {
        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competición no encontrada con ID: " + competitionId));

        String slug = comp.getExternalId();
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("La competición '" + comp.getName() + "' no tiene externalId (slug) configurado");
        }

        SportsDataProvider provider = sportsDataProviderRegistry.getProviderForCompetition(comp.getName());
        Map<String, Object> result = new LinkedHashMap<>();
        int importedTeams = 0;

        try {
            // 1. Descargar equipos y sus escudos oficiales
            JsonNode teamsNode = provider.fetchTeams(slug);
            Map<String, Team> teamCache = buildTeamCache();

            if (teamsNode != null && teamsNode.isArray()) {
                for (JsonNode item : teamsNode) {
                    JsonNode t = item.path("team");
                    if (t.isMissingNode()) t = item;

                    String id = t.path("id").asText(null);
                    String displayName = t.path("displayName").asText(t.path("name").asText(null));
                    String abbr = t.path("abbreviation").asText(null);
                    String logo = t.path("logos").path(0).path("href").asText(t.path("logo").asText(null));

                    if (displayName != null && !displayName.isBlank()) {
                        final String fName = displayName;
                        Team team = teamRepository.findByName(fName)
                                .or(() -> id != null ? teamRepository.findByExternalId(id) : Optional.empty())
                                .orElseGet(() -> Team.builder().name(fName).groupName("-").build());

                        team.setName(displayName);
                        if (abbr != null) team.setNameEn(abbr);
                        if (id != null) team.setExternalId(id);
                        if (logo != null && !logo.isBlank()) team.setLogoUrl(logo);

                        teamRepository.save(team);
                        teamCache.put(displayName, team);
                        if (id != null) teamCache.put(id, team);
                        importedTeams++;
                    }
                }
            }

            // 2. Descargar partidos del calendario de la temporada
            SyncContext context = new SyncContext();
            context.competition = comp;

            LocalDate today = LocalDate.now();
            List<String> datesToQuery = new ArrayList<>();
            datesToQuery.add(today.minusDays(1).format(DateTimeFormatter.ofPattern("yyyyMMdd")));
            datesToQuery.add(today.format(DateTimeFormatter.ofPattern("yyyyMMdd")));
            for (int i = 1; i <= 7; i++) {
                datesToQuery.add(today.plusDays(i).format(DateTimeFormatter.ofPattern("yyyyMMdd")));
            }

            List<String> calendarDates = provider.fetchSeasonCalendarDates(slug);
            for (String iso : calendarDates) {
                try {
                    LocalDate d = ZonedDateTime.parse(iso).toLocalDate();
                    if (!d.isBefore(today.minusDays(7)) && !d.isAfter(today.plusDays(30))) {
                        String ymd = d.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
                        if (!datesToQuery.contains(ymd)) datesToQuery.add(ymd);
                    }
                } catch (Exception ignored) {}
            }

            for (String dateStr : datesToQuery) {
                try {
                    JsonNode events = provider.fetchScoreboardEvents(slug, dateStr);
                    if (events != null && events.isArray()) {
                        for (JsonNode event : events) {
                            processEvent(event, teamCache, context);
                        }
                    }
                } catch (Exception e) {
                    log.debug("No events for {}: {}", dateStr, e.getMessage());
                }
            }

            result.put("status", "success");
            result.put("competition", comp.getName());
            result.put("slug", slug);
            result.put("importedTeams", importedTeams);
            result.put("importedMatches", context.matchesUpdated);
            log.info("Imported {} teams and {} matches for {}", importedTeams, context.matchesUpdated, comp.getName());
        } catch (Exception e) {
            log.error("Error al importar datos para {}: {}", comp.getName(), e.getMessage(), e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }

        return result;
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

        Team homeTeam = resolveOrPlaceholderTeam(homeComp, nameToTeamCache, context);
        Team awayTeam = resolveOrPlaceholderTeam(awayComp, nameToTeamCache, context);

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

    private Team resolveOrPlaceholderTeam(CompetitorNode comp, Map<String, Team> cache, SyncContext context) {
        if (comp == null) return getOrCreatePlaceholderTeam(cache);
        Team team = resolveAndUpdateTeam(comp, cache, context);
        if (team != null) return team;
        return getOrCreatePlaceholderTeam(cache);
    }

    private Team getOrCreatePlaceholderTeam(Map<String, Team> cache) {
        String placeholderName = "Por definir";
        if (cache.containsKey(placeholderName)) return cache.get(placeholderName);
        Team placeholder = teamRepository.findByName(placeholderName)
                .orElseGet(() -> teamRepository.save(Team.builder()
                        .name(placeholderName)
                        .nameEn("TBD")
                        .groupName("-")
                        .winOdds(1.0)
                        .qualifyOdds(1.0)
                        .outrightOdds(1.0)
                        .build()));
        cache.put(placeholderName, placeholder);
        cache.put("TBD", placeholder);
        return placeholder;
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
        String notes = competition.path("notes").toString();
        String headline = competition.path("headlines").toString();
        String combined = (altNote + " " + notes + " " + headline).toLowerCase();
        String group = null, round = "group";
        
        if (altNote.contains("Group ")) {
            group = altNote.substring(altNote.indexOf("Group ") + 6).trim();
            if (group.length() > 2) group = group.substring(0, 1);
            if (group != null) group = group.toUpperCase().trim();
        } else if (combined.contains("round of 32") || combined.contains("round of 16") || combined.contains("octav")) round = "r16";
        else if (combined.contains("quarter") || combined.contains("cuart") || combined.contains("qf")) round = "qf";
        else if (combined.contains("semi") || combined.contains("sf")) round = "sf";
        else if (combined.contains("third") || combined.contains("3rd") || combined.contains("tercer") || combined.contains("3er")) round = "third";
        else if (combined.contains("final")) round = "final";
        
        return new MatchMetadata(group, round);
    }

    private void upsertMatch(String espnEventId, Team home, Team away, MatchScores scores, 
                             LocalDateTime date, MatchStatus status, MatchMetadata meta, SyncContext context) {
        Match match = matchRepository.findByExternalId(espnEventId)
                .orElseGet(() -> Match.builder().externalId(espnEventId).build());

        boolean wasFinished = Boolean.TRUE.equals(match.getFinished());
        boolean updated = match.getId() == null;

        if (match.getCompetition() == null && context.competition != null) {
            match.setCompetition(context.competition);
            updated = true;
        }
        if (updateIfChanged(match.getHomeTeam(), home, match::setHomeTeam)) updated = true;
        if (updateIfChanged(match.getAwayTeam(), away, match::setAwayTeam)) updated = true;
        boolean scoreChanged = !Objects.equals(match.getHomeScore(), scores.home) || !Objects.equals(match.getAwayScore(), scores.away);
        if (updateIfChanged(match.getWinnerTeam(), scores.winner, match::setWinnerTeam)) updated = true;
        if (updateIfChanged(match.getHomeScore(), scores.home, match::setHomeScore)) updated = true;
        if (updateIfChanged(match.getAwayScore(), scores.away, match::setAwayScore)) updated = true;
        if (updateIfChanged(match.getMatchDate(), date, match::setMatchDate)) updated = true;
        if (updateIfChanged(match.getFinished(), status.finished, match::setFinished)) updated = true;
        if (updateIfChanged(match.getDisplayClock(), status.displayClock, match::setDisplayClock)) updated = true;
        String cleanGroup = meta.groupName != null && !"-".equals(meta.groupName) ? meta.groupName.toUpperCase().trim() : meta.groupName;
        if (updateIfChanged(match.getGroupName(), cleanGroup, match::setGroupName)) updated = true;
        if (updateIfChanged(match.getRound(), meta.round, match::setRound)) updated = true;

        MatchStatusNormalized normStatus = MatchStatusNormalized.fromExternal(
                status.isLive ? "in" : (status.finished ? "completed" : "scheduled"),
                status.finished
        );
        if (updateIfChanged(match.getStatus(), normStatus, match::setStatus)) updated = true;

        // Trigger evaluation and Pichichi refresh when a match finishes
        if (!wasFinished && status.finished) {
            log.info("Match just finished: {} - {}, evaluating predictions & scorer refresh", home.getName(), away.getName());
            try { matchPredictionService.evaluatePredictionsForMatch(match); } catch (Exception ex) { log.warn("Match prediction evaluation failed", ex); }
            try { topScorerService.refresh(); } catch (Exception ex) { log.warn("Scorer refresh failed", ex); }
        }

        if (updated) {
            matchRepository.save(match);
            context.matchesUpdated++;
            if (scoreChanged) {
                webSocketService.broadcastMatchScore(
                        match.getId(),
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : null,
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : null,
                        match.getHomeScore(),
                        match.getAwayScore(),
                        status.finished() ? "FINISHED" : (status.isLive() ? "IN_PLAY" : "SCHEDULED")
                );
            }
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

    private boolean isRound(String r, String... keys) {
        if (r == null) return false;
        String lower = r.toLowerCase();
        for (String k : keys) {
            if (lower.equals(k) || lower.contains(k)) return true;
        }
        return false;
    }

    public void propagateKnockoutWinners() {
        propagateKnockoutWinners(new SyncContext());
    }

    private void propagateKnockoutWinners(SyncContext context) {
        try {
            List<Match> allMatches = matchRepository.findAll();
            List<Match> sfMatches = allMatches.stream()
                    .filter(m -> isRound(m.getRound(), "sf", "semi"))
                    .filter(m -> Boolean.TRUE.equals(m.getFinished()) || m.getWinnerTeam() != null || (m.getHomeScore() != null && m.getAwayScore() != null && !Objects.equals(m.getHomeScore(), m.getAwayScore())))
                    .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());

            if (sfMatches.isEmpty()) return;

            List<Match> finals = allMatches.stream()
                    .filter(m -> isRound(m.getRound(), "final") && !isRound(m.getRound(), "semi", "quarter", "octav"))
                    .collect(Collectors.toList());
            List<Match> thirds = allMatches.stream()
                    .filter(m -> isRound(m.getRound(), "third", "tercer", "3rd", "3er"))
                    .collect(Collectors.toList());

            Match finalMatch = finals.isEmpty() ? null : finals.get(0);
            Match thirdMatch = thirds.isEmpty() ? null : thirds.get(0);

            for (int i = 0; i < sfMatches.size(); i++) {
                Match sf = sfMatches.get(i);
                Team winner = sf.getWinnerTeam();
                Team loser = getLoserTeam(sf);
                if (winner == null && sf.getHomeScore() != null && sf.getAwayScore() != null && !Objects.equals(sf.getHomeScore(), sf.getAwayScore())) {
                    winner = sf.getHomeScore() > sf.getAwayScore() ? sf.getHomeTeam() : sf.getAwayTeam();
                }

                if (finalMatch != null && winner != null) {
                    placeTeamInKnockoutMatch(finalMatch, winner, i == 0 ? "home" : "away", context);
                }
                if (thirdMatch != null && loser != null) {
                    placeTeamInKnockoutMatch(thirdMatch, loser, i == 0 ? "home" : "away", context);
                }
            }
        } catch (Exception e) {
            log.warn("Could not propagate knockout winners: {}", e.getMessage());
        }
    }

    public void enrichPredictionDataWithMatches(PredictionDataDTO dto) {
        if (dto == null) return;
        try {
            List<Match> allMatches = matchRepository.findAll();
            List<Match> finals = allMatches.stream()
                    .filter(m -> isRound(m.getRound(), "final") && !isRound(m.getRound(), "semi", "quarter", "octav"))
                    .collect(Collectors.toList());
            List<Match> thirds = allMatches.stream()
                    .filter(m -> isRound(m.getRound(), "third", "tercer", "3rd", "3er"))
                    .collect(Collectors.toList());
            List<Match> sfMatches = allMatches.stream()
                    .filter(m -> isRound(m.getRound(), "sf", "semi"))
                    .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());

            if (!finals.isEmpty()) {
                Match fm = finals.get(0);
                String h = fm.getHomeTeam() != null && !"Por definir".equalsIgnoreCase(fm.getHomeTeam().getName()) && !"TBD".equalsIgnoreCase(fm.getHomeTeam().getNameEn()) ? fm.getHomeTeam().getName() : null;
                String a = fm.getAwayTeam() != null && !"Por definir".equalsIgnoreCase(fm.getAwayTeam().getName()) && !"TBD".equalsIgnoreCase(fm.getAwayTeam().getNameEn()) ? fm.getAwayTeam().getName() : null;
                if (h == null && sfMatches.size() > 0) {
                    Match sf0 = sfMatches.get(0);
                    if (sf0.getWinnerTeam() != null) h = sf0.getWinnerTeam().getName();
                    else if (sf0.getHomeScore() != null && sf0.getAwayScore() != null && !Objects.equals(sf0.getHomeScore(), sf0.getAwayScore())) {
                        h = sf0.getHomeScore() > sf0.getAwayScore() && sf0.getHomeTeam() != null ? sf0.getHomeTeam().getName() : (sf0.getAwayTeam() != null ? sf0.getAwayTeam().getName() : null);
                    }
                }
                if (a == null && sfMatches.size() > 1) {
                    Match sf1 = sfMatches.get(1);
                    if (sf1.getWinnerTeam() != null) a = sf1.getWinnerTeam().getName();
                    else if (sf1.getHomeScore() != null && sf1.getAwayScore() != null && !Objects.equals(sf1.getHomeScore(), sf1.getAwayScore())) {
                        a = sf1.getHomeScore() > sf1.getAwayScore() && sf1.getHomeTeam() != null ? sf1.getHomeTeam().getName() : (sf1.getAwayTeam() != null ? sf1.getAwayTeam().getName() : null);
                    }
                }
                if (h != null || a != null) {
                    List<String> currentFinal = dto.getFinalMatch();
                    String curH = currentFinal != null && currentFinal.size() > 0 ? currentFinal.get(0) : null;
                    String curA = currentFinal != null && currentFinal.size() > 1 ? currentFinal.get(1) : null;
                    dto.setFinalMatch(Arrays.asList(h != null ? h : curH, a != null ? a : curA));
                }
                if (fm.getWinnerTeam() != null && !"Por definir".equalsIgnoreCase(fm.getWinnerTeam().getName())) {
                    dto.setChampion(fm.getWinnerTeam().getName());
                }
            } else if (sfMatches.size() >= 2) {
                String h = null, a = null;
                Match sf0 = sfMatches.get(0);
                if (sf0.getWinnerTeam() != null) h = sf0.getWinnerTeam().getName();
                else if (sf0.getHomeScore() != null && sf0.getAwayScore() != null && !Objects.equals(sf0.getHomeScore(), sf0.getAwayScore())) {
                    h = sf0.getHomeScore() > sf0.getAwayScore() && sf0.getHomeTeam() != null ? sf0.getHomeTeam().getName() : (sf0.getAwayTeam() != null ? sf0.getAwayTeam().getName() : null);
                }
                Match sf1 = sfMatches.get(1);
                if (sf1.getWinnerTeam() != null) a = sf1.getWinnerTeam().getName();
                else if (sf1.getHomeScore() != null && sf1.getAwayScore() != null && !Objects.equals(sf1.getHomeScore(), sf1.getAwayScore())) {
                    a = sf1.getHomeScore() > sf1.getAwayScore() && sf1.getHomeTeam() != null ? sf1.getHomeTeam().getName() : (sf1.getAwayTeam() != null ? sf1.getAwayTeam().getName() : null);
                }
                if (h != null || a != null) {
                    List<String> currentFinal = dto.getFinalMatch();
                    String curH = currentFinal != null && currentFinal.size() > 0 ? currentFinal.get(0) : null;
                    String curA = currentFinal != null && currentFinal.size() > 1 ? currentFinal.get(1) : null;
                    dto.setFinalMatch(Arrays.asList(h != null ? h : curH, a != null ? a : curA));
                }
            }

            if (!thirds.isEmpty() || sfMatches.size() >= 2) {
                Match tm = !thirds.isEmpty() ? thirds.get(0) : null;
                String h = tm != null && tm.getHomeTeam() != null && !"Por definir".equalsIgnoreCase(tm.getHomeTeam().getName()) && !"TBD".equalsIgnoreCase(tm.getHomeTeam().getNameEn()) ? tm.getHomeTeam().getName() : null;
                String a = tm != null && tm.getAwayTeam() != null && !"Por definir".equalsIgnoreCase(tm.getAwayTeam().getName()) && !"TBD".equalsIgnoreCase(tm.getAwayTeam().getNameEn()) ? tm.getAwayTeam().getName() : null;
                if (h == null && sfMatches.size() > 0) {
                    Match sf0 = sfMatches.get(0);
                    Team loser = getLoserTeam(sf0);
                    if (loser != null && !"Por definir".equalsIgnoreCase(loser.getName())) h = loser.getName();
                }
                if (a == null && sfMatches.size() > 1) {
                    Match sf1 = sfMatches.get(1);
                    Team loser = getLoserTeam(sf1);
                    if (loser != null && !"Por definir".equalsIgnoreCase(loser.getName())) a = loser.getName();
                }
                if (h != null || a != null) {
                    List<String> currentThird = dto.getThirdPlaceMatch();
                    String curH = currentThird != null && currentThird.size() > 0 ? currentThird.get(0) : null;
                    String curA = currentThird != null && currentThird.size() > 1 ? currentThird.get(1) : null;
                    dto.setThirdPlaceMatch(Arrays.asList(h != null ? h : curH, a != null ? a : curA));
                }
                if (tm != null && tm.getWinnerTeam() != null && !"Por definir".equalsIgnoreCase(tm.getWinnerTeam().getName())) {
                    dto.setThirdPlaceWinner(tm.getWinnerTeam().getName());
                } else if (tm != null && tm.getHomeScore() != null && tm.getAwayScore() != null && !Objects.equals(tm.getHomeScore(), tm.getAwayScore())) {
                    Team w = tm.getHomeScore() > tm.getAwayScore() ? tm.getHomeTeam() : tm.getAwayTeam();
                    if (w != null && !"Por definir".equalsIgnoreCase(w.getName())) dto.setThirdPlaceWinner(w.getName());
                }
            }
        } catch (Exception e) {
            log.warn("Could not enrich PredictionDataDTO with matches: {}", e.getMessage());
        }
    }

    public void enrichBetDataWithMatches(PredictionDataDTO dto) {
        enrichPredictionDataWithMatches(dto);
    }

    private Team getLoserTeam(Match m) {
        if (m == null || m.getHomeTeam() == null || m.getAwayTeam() == null) return null;
        if (m.getWinnerTeam() != null) {
            if (Objects.equals(m.getWinnerTeam().getId(), m.getHomeTeam().getId())) return m.getAwayTeam();
            return m.getHomeTeam();
        }
        if (m.getHomeScore() != null && m.getAwayScore() != null && !Objects.equals(m.getHomeScore(), m.getAwayScore())) {
            return m.getHomeScore() > m.getAwayScore() ? m.getAwayTeam() : m.getHomeTeam();
        }
        return null;
    }

    private void placeTeamInKnockoutMatch(Match match, Team team, String slot, SyncContext context) {
        if (team == null || "Por definir".equalsIgnoreCase(team.getName())) return;
        boolean updated = false;

        boolean homeIsPlaceholder = match.getHomeTeam() == null || "Por definir".equalsIgnoreCase(match.getHomeTeam().getName()) || "TBD".equalsIgnoreCase(match.getHomeTeam().getNameEn());
        boolean awayIsPlaceholder = match.getAwayTeam() == null || "Por definir".equalsIgnoreCase(match.getAwayTeam().getName()) || "TBD".equalsIgnoreCase(match.getAwayTeam().getNameEn());

        boolean alreadyHome = match.getHomeTeam() != null && Objects.equals(match.getHomeTeam().getId(), team.getId());
        boolean alreadyAway = match.getAwayTeam() != null && Objects.equals(match.getAwayTeam().getId(), team.getId());

        if (alreadyHome || alreadyAway) return;

        if ("home".equals(slot) && homeIsPlaceholder) {
            match.setHomeTeam(team);
            updated = true;
        } else if ("away".equals(slot) && awayIsPlaceholder) {
            match.setAwayTeam(team);
            updated = true;
        } else if (homeIsPlaceholder) {
            match.setHomeTeam(team);
            updated = true;
        } else if (awayIsPlaceholder) {
            match.setAwayTeam(team);
            updated = true;
        }

        if (updated) {
            matchRepository.save(match);
            context.matchesUpdated++;
        }
    }

    private void updateStandings(Map<Long, int[]> teamStats) {
        if (teamStats == null || teamStats.isEmpty()) {
            standingsService.recalculateStandingsFromMatches();
            return;
        }
        standingsService.clearAll();
        for (Map.Entry<Long, int[]> entry : teamStats.entrySet()) {
            teamRepository.findById(entry.getKey()).ifPresent(team -> {
                if (team.getGroupName() != null && !"-".equals(team.getGroupName()) && !"Por definir".equalsIgnoreCase(team.getName())) {
                    standingsService.updateStanding(team, team.getGroupName().toUpperCase().trim(),
                            entry.getValue()[0], entry.getValue()[1], entry.getValue()[2], entry.getValue()[3], entry.getValue()[4]);
                }
            });
        }

        teamRepository.findAll().forEach(team -> {
            if (team.getGroupName() != null && !"-".equals(team.getGroupName()) && !"Por definir".equalsIgnoreCase(team.getName()) && !teamStats.containsKey(team.getId())) {
                standingsService.updateStanding(team, team.getGroupName().toUpperCase().trim(), 0, 0, 0, 0, 0);
            }
        });
    }

    /**
     * Fallback method llamado si el proveedor falla repetidas veces.
     */
    public Map<String, Object> syncFallback(Exception e) {
        lastSyncTime = LocalDateTime.now();
        lastSyncStatus = "circuit_breaker_open";
        lastErrorMessage = e.getMessage();
        log.warn("Circuit Breaker OPEN or API call failed. Fallback activated. Error: {}", e.getMessage());
        return Map.of("status", "error", "message", "Circuit Breaker activado por fallos reiterados en la API. Reintentando más tarde.");
    }

    private boolean isStartingSoon(LocalDateTime matchDate) {
        if (matchDate == null) return false;
        long diffMs = Duration.between(LocalDateTime.now(), matchDate).toMillis();
        return diffMs > 0 && diffMs <= 30 * 60 * 1000;
    }

    private static class SyncContext {
        int teamsUpdated = 0;
        int matchesUpdated = 0;
        Map<Long, int[]> teamStats = new HashMap<>();
        com.porra.mundial.model.Competition competition;
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
