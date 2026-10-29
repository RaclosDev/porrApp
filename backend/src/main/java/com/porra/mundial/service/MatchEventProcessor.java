package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.porra.mundial.config.Constants;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Traduce los eventos y equipos del marcador de ESPN a entidades {@link Match} y {@link Team}.
 * Solo guarda cambios reales y, cuando un partido termina, dispara la evaluación de pronósticos
 * y el refresco de goleadores.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchEventProcessor {

    private static final ZoneId SPAIN_ZONE = ZoneId.of("Europe/Madrid");
    private static final long TEAM_CACHE_TTL_MS = 3_600_000;

    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final MatchPredictionService matchPredictionService;
    private final TopScorerService topScorerService;
    private final WebSocketService webSocketService;

    private final Map<String, Team> teamCache = new ConcurrentHashMap<>();
    private volatile long lastTeamCacheRefresh = 0;

    /** Acumula lo que cambia durante una sincronización o importación. */
    public static final class Batch {
        private final Competition competition;
        private int teamsUpdated;
        private int matchesUpdated;

        public Batch(Competition competition) {
            this.competition = competition;
        }

        public int teamsUpdated() {
            return teamsUpdated;
        }

        public int matchesUpdated() {
            return matchesUpdated;
        }
    }

    private record MatchStatus(boolean live, boolean finished, String displayClock) {
    }

    private record Competitor(JsonNode node, String nameEn, String espnId) {
    }

    private record MatchMetadata(String groupName, String round) {
    }

    private record Scores(Integer home, Integer away, Team winner) {
    }

    /** Equipos indexados por nombre, nombre en inglés e id externo; se refresca cada hora. */
    public Map<String, Team> teamCache() {
        long now = System.currentTimeMillis();
        if (teamCache.isEmpty() || now - lastTeamCacheRefresh > TEAM_CACHE_TTL_MS) {
            Map<String, Team> fresh = new HashMap<>();
            teamRepository.findAll().forEach(team -> {
                if (team.getName() != null) fresh.put(team.getName(), team);
                if (team.getNameEn() != null) fresh.put(team.getNameEn(), team);
                if (team.getExternalId() != null) fresh.put(team.getExternalId(), team);
            });
            teamCache.clear();
            teamCache.putAll(fresh);
            lastTeamCacheRefresh = now;
        }
        return teamCache;
    }

    /**
     * Guarda los equipos (con escudo) del catálogo de una competición.
     *
     * @return número de equipos importados
     */
    public int importTeams(JsonNode teamsNode, Map<String, Team> cache) {
        if (teamsNode == null || !teamsNode.isArray()) return 0;
        int imported = 0;
        for (JsonNode item : teamsNode) {
            JsonNode t = item.path("team").isMissingNode() ? item : item.path("team");
            String id = t.path("id").asText(null);
            String displayName = t.path("displayName").asText(t.path("name").asText(null));
            if (displayName == null || displayName.isBlank()) continue;

            String abbr = t.path("abbreviation").asText(null);
            String logo = t.path("logos").path(0).path("href").asText(t.path("logo").asText(null));

            Team team = teamRepository.findByName(displayName)
                    .or(() -> id != null ? teamRepository.findByExternalId(id) : Optional.empty())
                    .orElseGet(() -> Team.builder().name(displayName).groupName("-").build());
            team.setName(displayName);
            if (abbr != null) team.setNameEn(abbr);
            if (id != null) team.setExternalId(id);
            if (logo != null && !logo.isBlank()) team.setLogoUrl(logo);

            teamRepository.save(team);
            cache.put(displayName, team);
            if (id != null) cache.put(id, team);
            imported++;
        }
        return imported;
    }

    /** Crea o actualiza el partido descrito por un evento del marcador. */
    public void process(JsonNode event, Map<String, Team> cache, Batch batch) {
        String eventId = event.path("id").asText(null);
        JsonNode competition = event.path("competitions").get(0);
        if (eventId == null || competition == null) return;

        JsonNode competitors = competition.path("competitors");
        if (!competitors.isArray() || competitors.size() < 2) return;

        Competitor home = findCompetitor(competitors, "home");
        Competitor away = findCompetitor(competitors, "away");
        Team homeTeam = resolveTeam(home, cache, batch);
        Team awayTeam = resolveTeam(away, cache, batch);
        // Huecos del calendario sin ningún rival conocido: no se guardan.
        if (Team.isPlaceholder(homeTeam) && Team.isPlaceholder(awayTeam)) return;

        MatchStatus status = parseStatus(competition);
        Scores scores = parseScores(home, away, homeTeam, awayTeam, status);
        MatchMetadata metadata = parseMetadata(competition, batch.competition);
        int[] fairPlay = fairPlayPoints(competition, home, away, homeTeam, awayTeam);

        upsertMatch(eventId, homeTeam, awayTeam, scores, fairPlay, parseDate(event.path("date").asText(null)),
                status, metadata, batch);
    }

    /** Fecha del evento en hora peninsular española, o null si no se puede interpretar. */
    public LocalDateTime parseDate(String isoDate) {
        if (isoDate == null) return null;
        try {
            return ZonedDateTime.parse(isoDate).withZoneSameInstant(SPAIN_ZONE).toLocalDateTime();
        } catch (Exception e) {
            log.debug("Fecha no interpretable '{}': {}", isoDate, e.getMessage());
            return null;
        }
    }

    private MatchStatus parseStatus(JsonNode competition) {
        JsonNode type = competition.path("status").path("type");
        return new MatchStatus(
                "in".equals(type.path("state").asText("")),
                type.path("completed").asBoolean(false),
                competition.path("status").path("displayClock").asText(null));
    }

    private Competitor findCompetitor(JsonNode competitors, String homeAway) {
        for (JsonNode node : competitors) {
            if (homeAway.equals(node.path("homeAway").asText())) {
                String name = node.path("team").path("displayName").asText(null);
                String id = node.path("team").path("id").asText(null);
                return name != null && id != null ? new Competitor(node, name, id) : null;
            }
        }
        return null;
    }

    /** Equipo conocido (actualizando su nombre en inglés e id externo) o el comodín "Por definir". */
    private Team resolveTeam(Competitor competitor, Map<String, Team> cache, Batch batch) {
        Team team = competitor != null ? findTeam(competitor, cache) : null;
        if (team == null) return placeholderTeam(cache);

        boolean changed = false;
        if (!Objects.equals(team.getNameEn(), competitor.nameEn())) {
            team.setNameEn(competitor.nameEn());
            changed = true;
        }
        if (!Objects.equals(team.getExternalId(), competitor.espnId())) {
            team.setExternalId(competitor.espnId());
            changed = true;
        }
        if (changed) {
            teamRepository.save(team);
            cache.put(competitor.nameEn(), team);
            cache.put(competitor.espnId(), team);
            batch.teamsUpdated++;
        }
        return team;
    }

    private Team findTeam(Competitor competitor, Map<String, Team> cache) {
        String localName = Constants.getLocalName(competitor.nameEn());
        for (String key : new String[]{localName, competitor.nameEn(), competitor.espnId()}) {
            if (key != null && cache.containsKey(key)) return cache.get(key);
        }
        if (localName == null) return null;
        Team team = teamRepository.findByName(localName).orElse(null);
        if (team != null) cache.put(localName, team);
        return team;
    }

    private Team placeholderTeam(Map<String, Team> cache) {
        Team cached = cache.get(Team.PLACEHOLDER_NAME);
        if (cached != null) return cached;
        Team placeholder = teamRepository.findByName(Team.PLACEHOLDER_NAME)
                .orElseGet(() -> teamRepository.save(Team.builder()
                        .name(Team.PLACEHOLDER_NAME)
                        .nameEn(Team.PLACEHOLDER_NAME_EN)
                        .groupName("-")
                        .winOdds(1.0)
                        .qualifyOdds(1.0)
                        .outrightOdds(1.0)
                        .build()));
        cache.put(Team.PLACEHOLDER_NAME, placeholder);
        cache.put(Team.PLACEHOLDER_NAME_EN, placeholder);
        return placeholder;
    }

    private Scores parseScores(Competitor home, Competitor away, Team homeTeam, Team awayTeam, MatchStatus status) {
        if (!status.live() && !status.finished() || home == null || away == null) {
            return new Scores(null, null, null);
        }
        Integer homeScore = null;
        Integer awayScore = null;
        try {
            homeScore = Integer.parseInt(home.node().path("score").asText(""));
            awayScore = Integer.parseInt(away.node().path("score").asText(""));
        } catch (NumberFormatException ignored) {
            // Marcador aún no disponible.
        }
        boolean homeWins = home.node().path("advance").asBoolean(home.node().path("winner").asBoolean(false));
        boolean awayWins = away.node().path("advance").asBoolean(away.node().path("winner").asBoolean(false));
        Team winner = homeWins && !awayWins ? homeTeam : (awayWins && !homeWins ? awayTeam : null);
        return new Scores(homeScore, awayScore, winner);
    }

    /** Grupo y ronda a partir de las notas del evento. Las competiciones de liga no tienen ronda. */
    private MatchMetadata parseMetadata(JsonNode competition, Competition comp) {
        String altNote = competition.path("altGameNote").asText("");
        String note = (altNote + " " + competition.path("notes")).toLowerCase();

        String group = null;
        if (altNote.contains("Group ")) {
            group = altNote.substring(altNote.indexOf("Group ") + 6).trim();
            if (group.length() > 2) group = group.substring(0, 1);
            group = group.toUpperCase();
        }
        if (comp != null && "LEAGUE".equalsIgnoreCase(comp.getFormatType())) {
            return new MatchMetadata(group, null);
        }

        String round;
        if (group != null || note.contains("group ") || note.contains("grupo ")) {
            round = "group";
        } else if (note.contains("round of 32") || note.contains("16avo") || note.contains("dieciseis")) {
            round = "r32";
        } else if (note.contains("round of 16") || note.contains("octav")) {
            round = "r16";
        } else if (note.contains("quarter") || note.contains("cuart") || note.contains("qf")) {
            round = "qf";
        } else if (note.contains("semi") || note.contains("sf")) {
            round = "sf";
        } else if (note.contains("third place") || note.contains("3rd place") || note.contains("tercer puesto") || note.contains("3er puesto")) {
            round = "third";
        } else if (note.contains("final") && !note.contains("quarter") && !note.contains("octav") && !note.contains("third") && !note.contains("tercer")) {
            round = "final";
        } else {
            round = "group";
        }
        return new MatchMetadata(group, round);
    }

    private void upsertMatch(String eventId, Team home, Team away, Scores scores, int[] fairPlay,
                             LocalDateTime date, MatchStatus status, MatchMetadata meta, Batch batch) {
        Match match = matchRepository.findByExternalId(eventId)
                .orElseGet(() -> Match.builder().externalId(eventId).build());

        boolean wasFinished = Boolean.TRUE.equals(match.getFinished());
        boolean updated = match.getId() == null;
        boolean scoreChanged = !Objects.equals(match.getHomeScore(), scores.home())
                || !Objects.equals(match.getAwayScore(), scores.away());

        if (match.getCompetition() == null && batch.competition != null) {
            match.setCompetition(batch.competition);
            updated = true;
        }
        updated |= setIfChanged(match.getHomeTeam(), home, match::setHomeTeam);
        updated |= setIfChanged(match.getAwayTeam(), away, match::setAwayTeam);
        updated |= setIfChanged(match.getWinnerTeam(), scores.winner(), match::setWinnerTeam);
        updated |= setIfChanged(match.getHomeScore(), scores.home(), match::setHomeScore);
        updated |= setIfChanged(match.getAwayScore(), scores.away(), match::setAwayScore);
        updated |= setIfChanged(match.getMatchDate(), date, match::setMatchDate);
        updated |= setIfChanged(match.getFinished(), status.finished(), match::setFinished);
        updated |= setIfChanged(match.getDisplayClock(), status.displayClock(), match::setDisplayClock);
        if (meta.groupName() != null) {
            updated |= setIfChanged(match.getGroupName(), meta.groupName(), match::setGroupName);
        }
        // La ronda "group" es la de por defecto: nunca sobrescribe una ronda ya asignada.
        if (meta.round() != null && !"group".equals(meta.round())) {
            updated |= setIfChanged(match.getRound(), meta.round(), match::setRound);
        }
        updated |= setIfChanged(match.getHomeFairPlay(), fairPlay[0], match::setHomeFairPlay);
        updated |= setIfChanged(match.getAwayFairPlay(), fairPlay[1], match::setAwayFairPlay);

        MatchStatusNormalized normalized = MatchStatusNormalized.fromExternal(
                status.live() ? "in" : (status.finished() ? "completed" : "scheduled"), status.finished());
        updated |= setIfChanged(match.getStatus(), normalized, match::setStatus);

        if (!wasFinished && status.finished()) {
            log.info("Partido finalizado: {} - {}. Evaluando pronósticos y goleadores", home.getName(), away.getName());
            try {
                matchPredictionService.evaluatePredictionsForMatch(match);
            } catch (Exception e) {
                log.warn("Falló la evaluación de pronósticos del partido", e);
            }
            try {
                topScorerService.refresh();
            } catch (Exception e) {
                log.warn("Falló el refresco de goleadores", e);
            }
        }

        if (!updated) return;
        matchRepository.save(match);
        batch.matchesUpdated++;
        if (scoreChanged) {
            webSocketService.broadcastMatchScore(
                    match.getId(),
                    match.getHomeTeam() != null ? match.getHomeTeam().getName() : null,
                    match.getAwayTeam() != null ? match.getAwayTeam().getName() : null,
                    match.getHomeScore(),
                    match.getAwayScore(),
                    status.finished() ? "FINISHED" : (status.live() ? "IN_PLAY" : "SCHEDULED"));
        }
    }

    private static <T> boolean setIfChanged(T current, T value, Consumer<T> setter) {
        if (Objects.equals(current, value)) return false;
        setter.accept(value);
        return true;
    }

    /**
     * Puntos de fair play (desempate de grupos) de cada equipo:
     * amarilla -1, segunda amarilla -2 adicional, roja directa -4.
     */
    private int[] fairPlayPoints(JsonNode competition, Competitor home, Competitor away, Team homeTeam, Team awayTeam) {
        int[] points = {0, 0};
        JsonNode details = competition.path("details");
        if (!details.isArray()) return points;

        String homeEspnId = home != null ? home.espnId() : null;
        String awayEspnId = away != null ? away.espnId() : null;
        Set<String> booked = new HashSet<>();
        for (JsonNode detail : details) {
            boolean yellow = detail.path("yellowCard").asBoolean(false);
            boolean red = detail.path("redCard").asBoolean(false);
            if (!yellow && !red) continue;

            JsonNode athletes = detail.path("athletesInvolved");
            String playerId = athletes.isArray() && !athletes.isEmpty() ? athletes.get(0).path("id").asText(null) : null;
            int penalty = red ? -4 : (playerId != null && !booked.add(playerId) ? -2 : -1);

            String teamId = detail.path("team").path("id").asText(null);
            if (teamId != null && (teamId.equals(homeEspnId) || Objects.equals(homeTeam.getExternalId(), teamId))) {
                points[0] += penalty;
            } else if (teamId != null && (teamId.equals(awayEspnId) || Objects.equals(awayTeam.getExternalId(), teamId))) {
                points[1] += penalty;
            }
        }
        return points;
    }
}
