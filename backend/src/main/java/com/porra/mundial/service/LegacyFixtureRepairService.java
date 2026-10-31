package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.sports.SportsDataProviderRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Repara referencias históricas desde eventos oficiales, sin renombrar ids de equipos por deducción. */
@Service
@RequiredArgsConstructor
@Slf4j
public class LegacyFixtureRepairService {
    static final int BATCH_SIZE = 20;
    private static final int SCAN_LIMIT = 200;
    private static final Duration RETRY_DELAY = Duration.ofHours(6);
    private final MatchRepository matches;
    private final TeamRepository teams;
    private final SportsDataProviderRegistry providers;
    private final MatchEventProcessor processor;
    private final ScoreInvalidationService scores;
    private final WebSocketService updates;
    private final PlatformTransactionManager transactionManager;
    private final Map<Long, Instant> retryAfter = new HashMap<>();

    public record RepairResult(int attempted, int repaired, int failed) {}

    public RepairResult repairBatch() {
        return repairBatch(Instant.now());
    }

    synchronized RepairResult repairBatch(Instant now) {
        retryAfter.values().removeIf(deadline -> !deadline.isAfter(now));
        long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
        int attempted = 0;
        int repaired = 0;
        int failed = 0;
        int scanned = 0;
        long cursor = 0;
        while (attempted < BATCH_SIZE && scanned < SCAN_LIMIT && System.nanoTime() < deadline
                && !Thread.currentThread().isInterrupted()) {
            List<Match> candidates = matches.findLegacyPlaceholderFixtures(cursor, PageRequest.ofSize(BATCH_SIZE));
            if (candidates.isEmpty()) break;
            for (Match candidate : candidates) {
                cursor = candidate.getId();
                scanned++;
                if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline)
                    return new RepairResult(attempted, repaired, failed);
                if (retryAfter.containsKey(candidate.getId())
                        || (!legacy(candidate.getHomeTeam()) && !legacy(candidate.getAwayTeam()))) continue;
                var provider = providers.getProviderForCompetition(candidate.getCompetition().getExternalId());
                if (!provider.isAvailable()) return new RepairResult(attempted, repaired, failed);
                attempted++;
                try {
                    JsonNode event = provider.fetchEvent(candidate.getCompetition().getExternalId(), candidate.getExternalId());
                    validateEvent(candidate, event);
                    if (Thread.currentThread().isInterrupted()) return new RepairResult(attempted, repaired, failed);
                    boolean changed = Boolean.TRUE.equals(new TransactionTemplate(transactionManager)
                            .execute(status -> apply(candidate, event)));
                    if (changed) {
                        repaired++;
                        updates.notifyResultsChanged();
                    }
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    return new RepairResult(attempted, repaired, failed);
                } catch (Exception error) {
                    failed++;
                    retryAfter.put(candidate.getId(), now.plus(RETRY_DELAY));
                    log.warn("No se pudo reparar el partido {} (evento {}): {}", candidate.getId(),
                            candidate.getExternalId(), error.getMessage());
                }
                if (attempted >= BATCH_SIZE) break;
            }
        }
        return new RepairResult(attempted, repaired, failed);
    }

    private boolean apply(Match candidate, JsonNode event) {
        Match current = matches.findByExternalId(candidate.getExternalId()).orElseThrow();
        if (!Objects.equals(current.getId(), candidate.getId())
                || !Objects.equals(current.getCompetition().getId(), candidate.getCompetition().getId())) {
            throw new IllegalStateException("El partido cambió durante la consulta al proveedor");
        }
        if (!legacy(current.getHomeTeam()) && !legacy(current.getAwayTeam())) return false;
        Map<String, Team> cache = new HashMap<>();
        for (JsonNode competitor : event.path("competitions").get(0).path("competitors")) {
            JsonNode official = competitor.path("team");
            String externalId = official.path("id").asText();
            String name = official.path("displayName").asText();
            Team team = teams.findByExternalId(externalId).orElseGet(() -> teams.findByName(name)
                    .orElseGet(() -> Team.builder().name(name).groupName("-").build()));
            if (legacy(team) || (team.getExternalId() != null && !externalId.equals(team.getExternalId()))) {
                throw new IllegalStateException("Identidad de equipo incompatible con el evento oficial");
            }
            team.setExternalId(externalId);
            String logo = official.path("logos").path(0).path("href").asText(official.path("logo").asText(""));
            if (!logo.isBlank()) team.setLogoUrl(logo);
            teams.save(team);
            cache.put(externalId, team);
            cache.put(name, team);
        }
        var batch = new MatchEventProcessor.Batch(current.getCompetition());
        processor.process(event, cache, batch);
        if (legacy(current.getHomeTeam()) || legacy(current.getAwayTeam())) {
            throw new IllegalStateException("El evento no resolvió los equipos provisionales");
        }
        scores.invalidateCompetition(current.getCompetition().getId());
        return true;
    }

    private void validateEvent(Match candidate, JsonNode event) {
        if (event == null || !candidate.getExternalId().equals(event.path("id").asText())
                || !candidate.getCompetition().getExternalId().equals(event.path("league").path("slug").asText())) {
            throw new IllegalArgumentException("Evento o competición inesperados");
        }
        JsonNode competitions = event.path("competitions");
        if (!competitions.isArray() || competitions.size() != 1
                || !candidate.getExternalId().equals(competitions.get(0).path("id").asText())
                || !competitions.get(0).path("status").path("type").isObject()) {
            throw new IllegalArgumentException("Resumen de partido incompleto");
        }
        JsonNode status = competitions.get(0).path("status").path("type");
        if (!status.path("completed").isBoolean() || !status.path("state").isTextual())
            throw new IllegalArgumentException("Estado de partido incompleto");
        ZonedDateTime.parse(event.path("date").asText());
        JsonNode competitors = competitions.get(0).path("competitors");
        Set<String> sides = new HashSet<>();
        Set<String> identities = new HashSet<>();
        if (!competitors.isArray() || competitors.size() != 2) throw new IllegalArgumentException("Faltan los rivales");
        for (JsonNode competitor : competitors) {
            if (status.path("completed").asBoolean() && !competitor.path("score").asText().matches("[0-9]{1,3}"))
                throw new IllegalArgumentException("Marcador final incompleto");
            String side = competitor.path("homeAway").asText();
            String id = competitor.path("team").path("id").asText();
            String name = competitor.path("team").path("displayName").asText();
            if (!Set.of("home", "away").contains(side) || !sides.add(side) || !identities.add(id)
                    || !id.matches("[0-9]+") || name.isBlank() || name.startsWith("Equipo LaLiga ")
                    || Team.isPlaceholder(Team.builder().name(name).build())) {
                throw new IllegalArgumentException("Identidad de rival no válida");
            }
        }
    }

    private static boolean legacy(Team team) {
        return team != null && team.getName() != null && team.getName().matches("Equipo LaLiga [0-9]+");
    }
}
