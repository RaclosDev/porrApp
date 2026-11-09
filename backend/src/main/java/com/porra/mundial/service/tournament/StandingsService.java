package com.porra.mundial.service.tournament;

import com.porra.mundial.service.prediction.ScoreInvalidationService;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.TournamentFormat;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.GroupStandingRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Clasificación de la fase de grupos de un torneo: cada fila es de una competición. Los desempates son
 * los del artículo 13 del reglamento del Mundial, en {@link GroupTiebreaker}; qué terceros pasan lo
 * dice el {@link TournamentFormat} del torneo.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StandingsService {

    /** Un recálculo por torneo a la vez; los de torneos distintos no se estorban. */
    private final Map<Long, java.util.concurrent.locks.ReentrantLock> recalculateLocks = new java.util.concurrent.ConcurrentHashMap<>();

    private final GroupStandingRepository standingRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final ScoreInvalidationService scoreInvalidationService;

    /** Clasificación de todos los grupos de un torneo, ya ordenada. */
    @org.springframework.cache.annotation.Cacheable(value = "standings", key = "#competition.id", sync = true)
    public List<GroupStanding> getStandings(Competition competition) {
        return standingsOf(competition.getId());
    }

    private List<GroupStanding> standingsOf(Long competitionId) {
        List<GroupStanding> raw = standingRepository.findByCompetitionIdOrderByGroupNameAscPositionAsc(competitionId);
        if (raw == null) {
            raw = Collections.emptyList();
        }

        List<GroupStanding> standings = raw.stream()
                .filter(gs -> gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && (gs.getTeam() == null || !Team.PLACEHOLDER_NAME.equalsIgnoreCase(gs.getTeam().getName())))
                .collect(Collectors.toList());

        boolean hasPositions = !standings.isEmpty() && standings.stream().anyMatch(gs -> gs.getPosition() != null && gs.getPosition() > 0);
        if (hasPositions) {
            return standings;
        }

        Map<String, List<GroupStanding>> byGroup = standings.stream().collect(Collectors.groupingBy(gs -> gs.getGroupName().toUpperCase().trim()));
        List<Match> allMatches = matchRepository.findByCompetitionId(competitionId);
        List<GroupStanding> sorted = new ArrayList<>();
        byGroup.keySet().stream().sorted().forEach(group -> {
            List<Match> groupMatches = allMatches.stream()
                .filter(m -> group.equalsIgnoreCase(m.getGroupName()))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
            sorted.addAll(sortGroupStandings(byGroup.get(group), groupMatches));
        });
        return sorted;
    }

    /**
     * Ordena un grupo con los desempates del artículo 13 del reglamento del Mundial (ver {@link GroupTiebreaker}).
     * @param standings Equipos desordenados.
     * @param allGroupMatches Partidos del grupo, para los enfrentamientos directos entre empatados.
     * @return Clasificación ordenada.
     */
    public List<GroupStanding> sortGroupStandings(List<GroupStanding> standings, List<Match> allGroupMatches) {
        if (standings == null || standings.isEmpty()) return Collections.emptyList();
        return GroupTiebreaker.sort(standings, allGroupMatches);
    }

    /** Grupos de un torneo: grupo → equipo → estadística (pts, diff, gls, mp, fp, pos, status). */
    @org.springframework.cache.annotation.Cacheable(value = "officialPoints", key = "#competition.id", sync = true)
    public Map<String, Map<String, Map<String, Integer>>> getGroupPoints(Competition competition) {
        TournamentFormat format = TournamentFormat.of(competition);
        Map<String, Map<String, Map<String, Integer>>> result = new TreeMap<>();
        List<GroupStanding> allStandings = standingsOf(competition.getId());

        boolean hasPositions = !allStandings.isEmpty() && allStandings.stream().anyMatch(gs -> gs.getPosition() != null && gs.getPosition() > 0);

        List<GroupStanding> thirdPlaceTeams = new ArrayList<>();
        Map<String, List<GroupStanding>> groupedStandings = allStandings.stream()
                .filter(gs -> gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && (gs.getTeam() == null || !Team.PLACEHOLDER_NAME.equalsIgnoreCase(gs.getTeam().getName())))
                .collect(Collectors.groupingBy(gs -> gs.getGroupName().toUpperCase().trim()));

        for (Map.Entry<String, List<GroupStanding>> entry : groupedStandings.entrySet()) {
            String group = entry.getKey();
            List<GroupStanding> groupList = entry.getValue();
            Map<String, Map<String, Integer>> groupMap = result.computeIfAbsent(group, k -> new LinkedHashMap<>());

            for (GroupStanding gs : groupList) {
                String teamName = gs.getTeam().getName().replaceAll("[.#$\\[\\]]", "");
                Map<String, Integer> stats = new LinkedHashMap<>();
                stats.put("pts", gs.getPoints() != null ? gs.getPoints() : 0);
                stats.put("diff", gs.getGoalDiff() != null ? gs.getGoalDiff() : 0);
                stats.put("gls", gs.getGoalsFor() != null ? gs.getGoalsFor() : 0);
                stats.put("mp", gs.getMatchesPlayed() != null ? gs.getMatchesPlayed() : 0);
                stats.put("fp", gs.getFairPlayPoints() != null ? gs.getFairPlayPoints() : 0);
                stats.put("pos", gs.getPosition() != null ? gs.getPosition() : 0);
                stats.put("status", gs.getStatus() != null ? gs.getStatus() : 0);
                groupMap.put(teamName, stats);
            }

            if (!hasPositions && groupList.size() >= 3) {
                thirdPlaceTeams.add(groupList.get(2));
            }
        }

        // Sin posiciones ni estados guardados, los terceros eliminados se calculan al vuelo.
        int bestThirds = format.bestThirds();
        if (format.ranksThirds() && !hasPositions && thirdPlaceTeams.size() >= bestThirds) {
            thirdPlaceTeams.sort(GroupTiebreaker.THIRD_PLACE_ORDER);

            int perTeam = format.groupMatchesPerTeam();
            List<Match> allGroupMatches = matchRepository.findByCompetitionId(competition.getId()).stream()
                    .filter(m -> "group".equalsIgnoreCase(m.getRound()))
                    .toList();
            boolean isGroupStageDone = !allGroupMatches.isEmpty() && allGroupMatches.stream().allMatch(m -> Boolean.TRUE.equals(m.getFinished()));
            boolean allThirdsPlayed = thirdPlaceTeams.stream().allMatch(gs -> gs.getMatchesPlayed() != null && gs.getMatchesPlayed() >= perTeam);
            boolean bottomPlayed = thirdPlaceTeams.size() > bestThirds && thirdPlaceTeams.subList(bestThirds, thirdPlaceTeams.size()).stream().allMatch(gs -> gs.getMatchesPlayed() != null && gs.getMatchesPlayed() >= perTeam);

            if (isGroupStageDone || allThirdsPlayed || bottomPlayed) {
                for (int i = bestThirds; i < thirdPlaceTeams.size(); i++) {
                    GroupStanding eliminatedThird = thirdPlaceTeams.get(i);
                    String groupName = eliminatedThird.getGroupName();
                    String teamName = eliminatedThird.getTeam().getName().replaceAll("[.#$\\[\\]]", "");
                    if (result.containsKey(groupName) && result.get(groupName).containsKey(teamName)) {
                        result.get(groupName).get(teamName).put("status", -1);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Recalcula la clasificación de los grupos de un torneo con sus partidos terminados y guarda
     * posiciones y estados matemáticos.
     */
    @org.springframework.transaction.annotation.Transactional
    public void recalculate(Competition competition) {
        recalculateWithLock(competition, () -> matchRepository.findByCompetitionId(competition.getId()));
    }

    /**
     * Igual que {@link #recalculate(Competition)}, con los partidos del torneo ya cargados: la
     * sincronización los lee una vez y los comparte con el cuadro de eliminatorias.
     */
    @org.springframework.transaction.annotation.Transactional
    public void recalculate(Competition competition, List<Match> matches) {
        recalculateWithLock(competition, () -> matches);
    }

    /** Si la clasificación de grupos del torneo ya está guardada. */
    public boolean hasStandings(Competition competition) {
        return standingRepository.existsByCompetitionId(competition.getId());
    }

    private void recalculateWithLock(Competition competition, java.util.function.Supplier<List<Match>> matches) {
        java.util.concurrent.locks.ReentrantLock lock = recalculateLocks.computeIfAbsent(
                competition.getId(), id -> new java.util.concurrent.locks.ReentrantLock());
        if (!lock.tryLock()) {
            log.info("Recálculo de la clasificación de {} omitido: ya hay otra ejecución en curso.", competition.getName());
            return;
        }
        try {
            doRecalculateStandings(competition, matches.get());
            scoreInvalidationService.evictStandingsAfterCommit();
        } finally {
            lock.unlock();
        }
    }

    private void doRecalculateStandings(Competition competition, List<Match> allMatches) {
        TournamentFormat format = TournamentFormat.of(competition);
        List<Match> groupMatches = allMatches.stream()
                .filter(m -> "group".equalsIgnoreCase(m.getRound()) && Boolean.TRUE.equals(m.getFinished())
                        && m.getHomeTeam() != null && m.getAwayTeam() != null
                        && m.getHomeScore() != null && m.getAwayScore() != null)
                .toList();

        Map<Long, int[]> teamStats = new HashMap<>(); // [pts, gd, gf, mp, fp]
        for (Match m : groupMatches) {
            Long homeId = m.getHomeTeam().getId();
            Long awayId = m.getAwayTeam().getId();
            int hScore = m.getHomeScore();
            int aScore = m.getAwayScore();

            int[] h = teamStats.computeIfAbsent(homeId, k -> new int[5]);
            int[] a = teamStats.computeIfAbsent(awayId, k -> new int[5]);

            h[3]++; // mp
            a[3]++; // mp

            h[2] += hScore; // gf
            a[2] += aScore; // gf

            h[1] += (hScore - aScore); // gd
            a[1] += (aScore - hScore); // gd

            int homeFp = m.getHomeFairPlay() != null ? m.getHomeFairPlay() : 0;
            int awayFp = m.getAwayFairPlay() != null ? m.getAwayFairPlay() : 0;
            h[4] += homeFp;
            a[4] += awayFp;

            if (hScore > aScore) {
                h[0] += 3;
            } else if (aScore > hScore) {
                a[0] += 3;
            } else {
                h[0] += 1;
                a[0] += 1;
            }
        }

        // Actualización in-place sin borrar la tabla para evitar StaleObjectStateException concurrente
        Map<Long, GroupStanding> existingByTeam = standingRepository
                .findByCompetitionIdOrderByGroupNameAscPositionAsc(competition.getId()).stream()
                .filter(gs -> gs.getTeam() != null && gs.getTeam().getId() != null)
                .collect(Collectors.toMap(gs -> gs.getTeam().getId(), gs -> gs, (a, b) -> a));
        Map<Long, List<Object>> previousStandings = new HashMap<>();
        existingByTeam.forEach((teamId, gs) -> previousStandings.put(teamId, scoringFields(gs)));

        Map<String, List<GroupStanding>> standingsByGroup = new TreeMap<>();

        for (Map.Entry<Team, String> member : groupTeams(format, allMatches).entrySet()) {
            Team team = member.getKey();
            String groupName = member.getValue();
            int[] stats = teamStats.getOrDefault(team.getId(), new int[5]);
            GroupStanding standing = existingByTeam.get(team.getId());
            if (standing == null) {
                standing = GroupStanding.builder()
                        .competition(competition)
                        .team(team)
                        .groupName(groupName)
                        .build();
            }
            standing.setGroupName(groupName);
            standing.setPoints(stats[0]);
            standing.setGoalDiff(stats[1]);
            standing.setGoalsFor(stats[2]);
            standing.setMatchesPlayed(stats[3]);
            standing.setFairPlayPoints(stats[4]);
            standing.setPosition(0);
            standing.setStatus(0);

            standingsByGroup.computeIfAbsent(groupName, k -> new ArrayList<>()).add(standing);
        }

        List<GroupStanding> allSortedStandings = new ArrayList<>();
        List<GroupStanding> thirdPlaceTeams = new ArrayList<>();

        for (Map.Entry<String, List<GroupStanding>> entry : standingsByGroup.entrySet()) {
            String group = entry.getKey();
            List<GroupStanding> groupList = entry.getValue();
            List<Match> matches = allMatches.stream()
                    .filter(m -> group.equalsIgnoreCase(m.getGroupName()))
                    .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();

            List<GroupStanding> sortedGroup = sortGroupStandings(groupList, matches);
            Map<Long, Integer> statusMap = MathematicalStatusCalculator.calculateStatus(sortedGroup, matches);

            for (int i = 0; i < sortedGroup.size(); i++) {
                GroupStanding gs = sortedGroup.get(i);
                gs.setPosition(i + 1);
                gs.setStatus(statusMap.getOrDefault(gs.getTeam().getId(), 0));
            }

            if (sortedGroup.size() >= 3) {
                thirdPlaceTeams.add(sortedGroup.get(2));
            }
            allSortedStandings.addAll(sortedGroup);
        }

        if (format.ranksThirds()) {
            eliminateWorstThirds(format, thirdPlaceTeams, allMatches);
        }

        standingRepository.saveAll(allSortedStandings);

        boolean changed = allSortedStandings.stream()
                .anyMatch(gs -> !scoringFields(gs).equals(previousStandings.get(gs.getTeam().getId())));
        if (changed) {
            scoreInvalidationService.invalidateCompetition(competition.getId());
        }
    }

    /** Marca como eliminados a los terceros que ya no pueden estar entre los mejores. */
    private static void eliminateWorstThirds(TournamentFormat format, List<GroupStanding> thirdPlaceTeams, List<Match> allMatches) {
        int bestThirds = format.bestThirds();
        int perTeam = format.groupMatchesPerTeam();
        thirdPlaceTeams.sort(GroupTiebreaker.THIRD_PLACE_ORDER);

        List<Match> allGroupMatches = allMatches.stream()
                .filter(m -> "group".equalsIgnoreCase(m.getRound()))
                .toList();
        boolean isGroupStageDone = !allGroupMatches.isEmpty() && allGroupMatches.stream().allMatch(m -> Boolean.TRUE.equals(m.getFinished()));
        boolean allThirdsPlayed = thirdPlaceTeams.size() >= bestThirds && thirdPlaceTeams.stream().allMatch(gs -> gs.getMatchesPlayed() >= perTeam);
        boolean bottomPlayed = thirdPlaceTeams.size() > bestThirds && thirdPlaceTeams.subList(bestThirds, thirdPlaceTeams.size()).stream().allMatch(gs -> gs.getMatchesPlayed() >= perTeam);

        if (isGroupStageDone || allThirdsPlayed || bottomPlayed) {
            for (int i = bestThirds; i < thirdPlaceTeams.size(); i++) {
                thirdPlaceTeams.get(i).setStatus(-1);
            }
        }
    }

    /**
     * Equipos de la fase de grupos, cada uno con su grupo. En un torneo con los grupos ya sorteados son
     * los equipos que llevan grupo; en el resto, los que juegan sus partidos de grupo.
     */
    private Map<Team, String> groupTeams(TournamentFormat format, List<Match> matches) {
        Map<Long, Team> teams = new LinkedHashMap<>();
        Map<Long, String> groups = new HashMap<>();
        if (format.seededGroups()) {
            for (Team team : teamRepository.findAll()) {
                if (!Team.isWorldCupGroupTeam(team)) continue;
                teams.put(team.getId(), team);
                groups.put(team.getId(), team.getGroupName().toUpperCase().trim());
            }
        } else {
            for (Match match : matches) {
                String group = match.getGroupName();
                if (!"group".equalsIgnoreCase(match.getRound()) || group == null || group.isBlank() || "-".equals(group.trim())) continue;
                for (Team team : Arrays.asList(match.getHomeTeam(), match.getAwayTeam())) {
                    if (Team.isPlaceholder(team) || team.getId() == null) continue;
                    teams.putIfAbsent(team.getId(), team);
                    groups.putIfAbsent(team.getId(), group.toUpperCase().trim());
                }
            }
        }
        Map<Team, String> result = new LinkedHashMap<>();
        teams.forEach((id, team) -> result.put(team, groups.get(id)));
        return result;
    }

    /** Datos de la clasificación que puntúan los cuadros: si cambia alguno, hay que recalcular las porras. */
    private static List<Object> scoringFields(GroupStanding gs) {
        return Arrays.asList(gs.getGroupName(), gs.getPoints(), gs.getGoalDiff(), gs.getGoalsFor(),
                gs.getMatchesPlayed(), gs.getFairPlayPoints(), gs.getPosition(), gs.getStatus());
    }
}
