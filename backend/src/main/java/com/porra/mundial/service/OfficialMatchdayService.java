package com.porra.mundial.service;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.sports.FootballDataClient;
import com.porra.mundial.sports.FootballDataClient.OfficialFixture;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pone a los partidos de liga su jornada oficial de football-data.org ("Jornada 13").
 * ESPN no da el número de jornada; sin esto se deduce por fechas al crear cada partido.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OfficialMatchdayService {

    private static final ZoneId MATCH_ZONE = ZoneId.of("Europe/Madrid");
    /** Margen alrededor del calendario oficial para no tocar partidos de otras temporadas. */
    private static final Duration SEASON_MARGIN = Duration.ofDays(30);
    private static final String[] CACHES = {"matches", "matchRadar", "matchdayStats", ScoreInvalidationService.LEADERBOARD_CACHE};

    private final FootballDataClient footballData;
    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final PlatformTransactionManager transactionManager;
    private final CacheManager cacheManager;

    /** Una llamada por liga cada seis horas: muy por debajo del límite del plan gratuito (10 por minuto). */
    @Scheduled(initialDelay = 180_000, fixedDelay = 6 * 60 * 60 * 1000)
    public void scheduledRefresh() {
        if (!footballData.isEnabled()) return;
        int relabeled = 0;
        for (var entry : footballData.competitionCodes().entrySet()) {
            try {
                relabeled += refresh(entry.getKey(), entry.getValue());
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception error) {
                log.warn("No se pudieron leer las jornadas oficiales de {}: {}", entry.getKey(), error.getMessage());
            }
        }
        if (relabeled > 0) clearCaches();
    }

    int refresh(String slug, String code) throws Exception {
        Competition competition = competitionRepository.findByExternalId(slug).orElse(null);
        if (competition == null || !"LEAGUE".equalsIgnoreCase(competition.getFormatType())) return 0;
        List<OfficialFixture> fixtures = footballData.fetchSeasonFixtures(code);
        if (fixtures.isEmpty()) return 0;
        Integer changed = new TransactionTemplate(transactionManager).execute(status -> {
            Map<Match, Integer> matchdays = assignMatchdays(matchRepository.findByCompetitionId(competition.getId()), fixtures);
            int count = 0;
            for (var assigned : matchdays.entrySet()) {
                String round = MatchEventProcessor.MATCHDAY_PREFIX + assigned.getValue();
                Match match = assigned.getKey();
                if (!round.equals(match.getRound())) {
                    match.setRound(round);
                    matchRepository.save(match);
                    count++;
                }
            }
            return count;
        });
        int relabeled = changed == null ? 0 : changed;
        if (relabeled > 0) log.info("Jornadas oficiales de {}: {} partidos actualizados", slug, relabeled);
        return relabeled;
    }

    /**
     * Empareja los partidos propios con el calendario oficial. Los equipos de ambos proveedores se
     * relacionan por los horarios en que solo se juega un partido; luego cada partido se busca por
     * su pareja local-visitante, única en una temporada de liga, así un aplazado conserva su jornada.
     */
    static Map<Match, Integer> assignMatchdays(List<Match> matches, List<OfficialFixture> fixtures) {
        Map<Match, Integer> result = new IdentityHashMap<>();
        if (fixtures.isEmpty()) return result;
        Instant first = fixtures.stream().map(OfficialFixture::kickoff).min(Instant::compareTo).orElseThrow();
        Instant last = fixtures.stream().map(OfficialFixture::kickoff).max(Instant::compareTo).orElseThrow();

        Map<Instant, List<Match>> oursBySlot = new HashMap<>();
        List<Match> season = new ArrayList<>();
        for (Match match : matches) {
            if (match.getMatchDate() == null || match.getHomeTeam() == null || match.getAwayTeam() == null
                    || match.getHomeTeam().getId() == null || match.getAwayTeam().getId() == null) continue;
            Instant kickoff = kickoff(match);
            if (kickoff.isBefore(first.minus(SEASON_MARGIN)) || kickoff.isAfter(last.plus(SEASON_MARGIN))) continue;
            season.add(match);
            oursBySlot.computeIfAbsent(kickoff, k -> new ArrayList<>()).add(match);
        }
        Map<Instant, List<OfficialFixture>> officialBySlot = new HashMap<>();
        for (OfficialFixture fixture : fixtures) {
            officialBySlot.computeIfAbsent(fixture.kickoff().truncatedTo(ChronoUnit.MINUTES), k -> new ArrayList<>()).add(fixture);
        }

        Map<Long, Long> teamMap = learnTeams(oursBySlot, officialBySlot);
        Map<String, OfficialFixture> byPair = new HashMap<>();
        for (OfficialFixture fixture : fixtures) {
            Long home = teamMap.get(fixture.homeTeamId());
            Long away = teamMap.get(fixture.awayTeamId());
            if (home != null && away != null) byPair.put(home + ":" + away, fixture);
        }
        for (Match match : season) {
            OfficialFixture fixture = byPair.get(match.getHomeTeam().getId() + ":" + match.getAwayTeam().getId());
            if (fixture == null) {
                List<OfficialFixture> sameSlot = officialBySlot.getOrDefault(kickoff(match), List.of());
                List<Match> oursSameSlot = oursBySlot.getOrDefault(kickoff(match), List.of());
                if (sameSlot.size() == 1 && oursSameSlot.size() == 1) fixture = sameSlot.get(0);
            }
            if (fixture != null) result.put(match, fixture.matchday());
        }
        return result;
    }

    /** Id oficial → id propio, aprendido de los horarios con un único partido en ambos lados. */
    private static Map<Long, Long> learnTeams(Map<Instant, List<Match>> ours, Map<Instant, List<OfficialFixture>> official) {
        Map<Long, Long> mapping = new HashMap<>();
        Set<Long> conflicting = new HashSet<>();
        for (var slot : ours.entrySet()) {
            List<OfficialFixture> candidates = official.get(slot.getKey());
            if (slot.getValue().size() != 1 || candidates == null || candidates.size() != 1) continue;
            Match match = slot.getValue().get(0);
            OfficialFixture fixture = candidates.get(0);
            link(mapping, conflicting, fixture.homeTeamId(), match.getHomeTeam().getId());
            link(mapping, conflicting, fixture.awayTeamId(), match.getAwayTeam().getId());
        }
        conflicting.forEach(mapping::remove);
        // Dos equipos oficiales no pueden ser el mismo equipo propio.
        Map<Long, Long> owners = new HashMap<>();
        Set<Long> shared = new HashSet<>();
        mapping.forEach((officialId, ownId) -> {
            Long previous = owners.putIfAbsent(ownId, officialId);
            if (previous != null) {
                shared.add(previous);
                shared.add(officialId);
            }
        });
        shared.forEach(mapping::remove);
        return mapping;
    }

    private static void link(Map<Long, Long> mapping, Set<Long> conflicting, long officialId, long ownId) {
        Long previous = mapping.putIfAbsent(officialId, ownId);
        if (previous != null && previous != ownId) conflicting.add(officialId);
    }

    private static Instant kickoff(Match match) {
        return match.getMatchDate().atZone(MATCH_ZONE).toInstant().truncatedTo(ChronoUnit.MINUTES);
    }

    private void clearCaches() {
        for (String name : CACHES) {
            Cache cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        }
    }
}
