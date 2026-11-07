package com.porra.mundial.service.tournament;

import com.porra.mundial.service.sync.MatchEventProcessor;
import com.porra.mundial.service.prediction.ScoreInvalidationService;
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
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
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

    /** Margen alrededor del calendario oficial para no tocar partidos de otras temporadas. */
    private static final Duration SEASON_MARGIN = Duration.ofDays(30);
    /** Votos mínimos para relacionar un equipo oficial con uno propio. */
    private static final int MIN_VOTES = 2;
    /** Diferencia máxima de horario al reconocer un partido por su rival conocido. */
    private static final Duration OPPONENT_WINDOW = Duration.ofDays(2);
    private static final String[] CACHES = {"matches", "matchRadar", "matchdayStats", ScoreInvalidationService.LEADERBOARD_CACHE};

    private final FootballDataClient footballData;
    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final PlatformTransactionManager transactionManager;
    private final CacheManager cacheManager;

    /** Una llamada por liga cada seis horas: muy por debajo del límite del plan gratuito (10 por minuto). */
    @Scheduled(initialDelay = 180_000, fixedDelay = 6 * 60 * 60 * 1000)
    @SchedulerLock(name = "officialMatchdays", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
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
            Assignment assignment = assignMatchdays(matchRepository.findByCompetitionId(competition.getId()), fixtures);
            int count = 0;
            for (var assigned : assignment.matchdays().entrySet()) {
                String round = MatchEventProcessor.MATCHDAY_PREFIX + assigned.getValue();
                Match match = assigned.getKey();
                if (!round.equals(match.getRound())) {
                    match.setRound(round);
                    matchRepository.save(match);
                    count++;
                }
            }
            log.info("Jornadas oficiales de {}: {} de {} partidos emparejados, {} equipos relacionados, {} actualizados",
                    slug, assignment.matchdays().size(), assignment.seasonMatches(), assignment.linkedTeams(), count);
            return count;
        });
        return changed == null ? 0 : changed;
    }

    /** Jornada oficial de cada partido emparejado, con los totales para el registro. */
    record Assignment(Map<Match, Integer> matchdays, int seasonMatches, int linkedTeams) {}

    /**
     * Empareja los partidos propios con el calendario oficial. Los equipos de ambos proveedores se
     * relacionan por votación en los horarios en que solo se juega un partido, así un horario que
     * difiere entre proveedores no rompe la relación; luego cada partido se busca por su pareja
     * local-visitante, única en una temporada de liga, así un aplazado conserva su jornada.
     */
    static Assignment assignMatchdays(List<Match> matches, List<OfficialFixture> fixtures) {
        Map<Match, Integer> result = new IdentityHashMap<>();
        if (fixtures.isEmpty()) return new Assignment(result, 0, 0);
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
        linkByKnownOpponents(teamMap, season, fixtures);
        Map<String, OfficialFixture> byPair = new HashMap<>();
        for (OfficialFixture fixture : fixtures) {
            Long home = teamMap.get(fixture.homeTeamId());
            Long away = teamMap.get(fixture.awayTeamId());
            if (home != null && away != null) byPair.put(home + ":" + away, fixture);
        }
        for (Match match : season) {
            OfficialFixture fixture = byPair.get(match.getHomeTeam().getId() + ":" + match.getAwayTeam().getId());
            if (fixture != null) result.put(match, fixture.matchday());
        }
        return new Assignment(result, season.size(), teamMap.size());
    }

    /**
     * Id oficial → id propio. Cada horario con un único partido en ambos lados es un voto; gana el
     * equipo con mayoría clara y al menos dos votos, y dos equipos oficiales no comparten equipo propio.
     */
    private static Map<Long, Long> learnTeams(Map<Instant, List<Match>> ours, Map<Instant, List<OfficialFixture>> official) {
        Map<Long, Map<Long, Integer>> votes = new HashMap<>();
        for (var slot : ours.entrySet()) {
            List<OfficialFixture> candidates = official.get(slot.getKey());
            if (slot.getValue().size() != 1 || candidates == null || candidates.size() != 1) continue;
            Match match = slot.getValue().get(0);
            OfficialFixture fixture = candidates.get(0);
            votes.computeIfAbsent(fixture.homeTeamId(), k -> new HashMap<>()).merge(match.getHomeTeam().getId(), 1, Integer::sum);
            votes.computeIfAbsent(fixture.awayTeamId(), k -> new HashMap<>()).merge(match.getAwayTeam().getId(), 1, Integer::sum);
        }
        Map<Long, Long> mapping = new HashMap<>();
        votes.forEach((officialId, counts) -> {
            Long winner = majority(counts);
            if (winner != null) mapping.put(officialId, winner);
        });
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

    /**
     * Completa los equipos que no se pudieron relacionar por horario: si en un partido oficial el rival
     * ya es conocido y ese rival juega en casa (o fuera) un único partido propio en esas fechas, el otro
     * equipo de ese partido es un voto. Se repite mientras se relacionen equipos nuevos.
     */
    private static void linkByKnownOpponents(Map<Long, Long> mapping, List<Match> season, List<OfficialFixture> fixtures) {
        for (int pass = 0; pass < 5; pass++) {
            Set<Long> taken = new HashSet<>(mapping.values());
            Map<Long, Map<Long, Integer>> votes = new HashMap<>();
            for (OfficialFixture fixture : fixtures) {
                Long home = mapping.get(fixture.homeTeamId());
                Long away = mapping.get(fixture.awayTeamId());
                if ((home == null) == (away == null)) continue;
                boolean knownHome = home != null;
                Long known = knownHome ? home : away;
                List<Match> candidates = season.stream()
                        .filter(m -> known.equals(knownHome ? m.getHomeTeam().getId() : m.getAwayTeam().getId()))
                        .filter(m -> Duration.between(kickoff(m), fixture.kickoff()).abs().compareTo(OPPONENT_WINDOW) <= 0)
                        .toList();
                if (candidates.size() != 1) continue;
                Match match = candidates.get(0);
                long other = knownHome ? match.getAwayTeam().getId() : match.getHomeTeam().getId();
                if (taken.contains(other)) continue;
                long unknownOfficial = knownHome ? fixture.awayTeamId() : fixture.homeTeamId();
                votes.computeIfAbsent(unknownOfficial, k -> new HashMap<>()).merge(other, 1, Integer::sum);
            }
            Map<Long, Long> learned = new HashMap<>();
            votes.forEach((officialId, counts) -> {
                Long winner = majority(counts);
                if (winner != null) learned.put(officialId, winner);
            });
            Set<Long> owners = new HashSet<>();
            Set<Long> shared = new HashSet<>();
            learned.values().forEach(own -> { if (!owners.add(own)) shared.add(own); });
            learned.values().removeIf(shared::contains);
            if (learned.isEmpty()) return;
            mapping.putAll(learned);
        }
    }

    /** Equipo con mayoría clara y al menos {@link #MIN_VOTES} votos, o {@code null}. */
    private static Long majority(Map<Long, Integer> counts) {
        var ranked = counts.entrySet().stream().sorted(Map.Entry.<Long, Integer>comparingByValue().reversed()).toList();
        int top = ranked.get(0).getValue();
        int second = ranked.size() > 1 ? ranked.get(1).getValue() : 0;
        return top >= MIN_VOTES && top > 2 * second ? ranked.get(0).getKey() : null;
    }

    /**
     * Numera las jornadas de una liga tras importar su calendario: con la jornada oficial de football-data
     * cuando la cubre y, si no, deduciéndolas del calendario ({@link #inferMatchdays}). Sin esto, cada día
     * con partidos sería una jornada distinta.
     *
     * @return partidos cuya jornada ha cambiado
     */
    public int numberMatchdays(Competition competition) {
        if (competition == null || competition.getId() == null || competition.getExternalId() == null
                || !"LEAGUE".equalsIgnoreCase(competition.getFormatType())) {
            return 0;
        }
        String code = footballData.isEnabled() ? footballData.competitionCodes().get(competition.getExternalId()) : null;
        int changed;
        if (code != null) {
            try {
                changed = refresh(competition.getExternalId(), code);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return 0;
            } catch (Exception error) {
                log.warn("No se pudieron leer las jornadas oficiales de {}: {}", competition.getExternalId(), error.getMessage());
                return 0;
            }
        } else {
            Integer inferred = new TransactionTemplate(transactionManager).execute(status -> {
                int count = 0;
                for (var assigned : inferMatchdays(matchRepository.findByCompetitionId(competition.getId())).entrySet()) {
                    String round = MatchEventProcessor.MATCHDAY_PREFIX + assigned.getValue();
                    Match match = assigned.getKey();
                    if (!round.equals(match.getRound())) {
                        match.setRound(round);
                        matchRepository.save(match);
                        count++;
                    }
                }
                log.info("Jornadas deducidas de {}: {} partidos actualizados", competition.getExternalId(), count);
                return count;
            });
            changed = inferred == null ? 0 : inferred;
        }
        if (changed > 0) clearCaches();
        return changed;
    }

    /** Parón a partir del cual se da por empezada otra temporada. */
    private static final Duration NEW_SEASON_GAP = Duration.ofDays(45);

    /**
     * Jornadas de la temporada en curso cuando no hay calendario oficial: en orden de fecha, una jornada se
     * cierra cuando un equipo volvería a jugar o ya tiene todos sus partidos (la mitad de los equipos). Los
     * partidos de antes del último parón largo son de otra temporada y no se numeran.
     */
    static Map<Match, Integer> inferMatchdays(List<Match> matches) {
        List<Match> dated = matches.stream()
                .filter(m -> m.getMatchDate() != null && m.getHomeTeam() != null && m.getAwayTeam() != null
                        && m.getHomeTeam().getId() != null && m.getAwayTeam().getId() != null
                        && !com.porra.mundial.model.Team.isPlaceholder(m.getHomeTeam())
                        && !com.porra.mundial.model.Team.isPlaceholder(m.getAwayTeam()))
                .sorted(java.util.Comparator.comparing(Match::getMatchDate)
                        .thenComparing(Match::getId, java.util.Comparator.nullsLast(Long::compareTo)))
                .toList();
        int seasonStart = 0;
        for (int i = 1; i < dated.size(); i++) {
            if (Duration.between(dated.get(i - 1).getMatchDate(), dated.get(i).getMatchDate()).compareTo(NEW_SEASON_GAP) > 0) {
                seasonStart = i;
            }
        }
        List<Match> season = dated.subList(seasonStart, dated.size());
        Set<Long> teams = new HashSet<>();
        season.forEach(m -> {
            teams.add(m.getHomeTeam().getId());
            teams.add(m.getAwayTeam().getId());
        });
        int perRound = Math.max(1, teams.size() / 2);
        Map<Match, Integer> result = new IdentityHashMap<>();
        Set<Long> playing = new HashSet<>();
        int round = 1;
        for (Match match : season) {
            Long home = match.getHomeTeam().getId();
            Long away = match.getAwayTeam().getId();
            if (playing.contains(home) || playing.contains(away) || playing.size() / 2 >= perRound) {
                round++;
                playing.clear();
            }
            playing.add(home);
            playing.add(away);
            result.put(match, round);
        }
        return result;
    }

    private static Instant kickoff(Match match) {
        return match.getMatchDate().truncatedTo(ChronoUnit.MINUTES);
    }

    private void clearCaches() {
        for (String name : CACHES) {
            Cache cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        }
    }
}
