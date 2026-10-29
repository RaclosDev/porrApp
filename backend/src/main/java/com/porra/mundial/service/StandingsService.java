package com.porra.mundial.service;

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
 *  Servicio de Clasificaciones (StandingsService).
 * Gestiona y calcula la clasificación real de los grupos del Mundial.
 * Utiliza las reglas oficiales de desempate (Puntos > H2H > Goal Average > Goles).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StandingsService {

    private final java.util.concurrent.locks.ReentrantLock recalculateLock = new java.util.concurrent.locks.ReentrantLock();

    private final GroupStandingRepository standingRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;

    /**
     * Obtiene la clasificación completa de todos los grupos ya ordenada.
     */
    @org.springframework.cache.annotation.Cacheable("standings")
    public List<GroupStanding> getAllStandings() {
        List<GroupStanding> raw = standingRepository.findAllByOrderByGroupNameAscPositionAsc();
        if (raw == null || raw.isEmpty()) {
            raw = standingRepository.findAllByOrderByGroupNameAsc();
        }
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
        List<Match> allMatches = matchRepository.findAll();
        if (allMatches == null) allMatches = Collections.emptyList();
        List<GroupStanding> sorted = new ArrayList<>();
        List<Match> finalMatches = allMatches;
        byGroup.keySet().stream().sorted().forEach(group -> {
            List<Match> groupMatches = finalMatches.stream()
                .filter(m -> group.equalsIgnoreCase(m.getGroupName()))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
            sorted.addAll(sortGroupStandings(byGroup.get(group), groupMatches));
        });
        return sorted;
    }

    /**
     * Motor de ordenación. Aplica las reglas de desempate de la FIFA/UEFA.
     * @param standings Equipos desordenados.
     * @param allGroupMatches Partidos del grupo para calcular H2H en caso de empate.
     * @return Clasificación perfectamente ordenada.
     */
    public List<GroupStanding> sortGroupStandings(List<GroupStanding> standings, List<Match> allGroupMatches) {
        if (standings == null || standings.isEmpty()) return Collections.emptyList();

        List<Match> finishedMatches = allGroupMatches != null ? allGroupMatches.stream()
            .filter(m -> Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null)
            .collect(Collectors.toList()) : Collections.emptyList();

        // Group by points, overall GD, and overall GF to identify ties
        Map<String, List<GroupStanding>> tieGroups = standings.stream().collect(Collectors.groupingBy(
            gs -> String.format("%d_%d_%d", gs.getPoints(), gs.getGoalDiff(), gs.getGoalsFor())
        ));

        // Precalculate H2H stats for tied groups
        Map<Long, H2HStats> h2hStatsCache = new HashMap<>();
        tieGroups.values().stream().filter(group -> group.size() > 1).forEach(tiedGroup -> {
            List<Long> tiedTeamIds = tiedGroup.stream().map(gs -> gs.getTeam().getId()).collect(Collectors.toList());
            List<Match> h2hMatches = finishedMatches.stream()
                .filter(m -> tiedTeamIds.contains(m.getHomeTeam().getId()) && tiedTeamIds.contains(m.getAwayTeam().getId()))
                .collect(Collectors.toList());
            
            for (GroupStanding gs : tiedGroup) {
                h2hStatsCache.put(gs.getTeam().getId(), calculateH2HStats(gs.getTeam().getId(), h2hMatches));
            }
        });

        standings.sort((a, b) -> {
            if (!Objects.equals(a.getPoints(), b.getPoints())) return Integer.compare(b.getPoints(), a.getPoints());

            String tieKeyA = String.format("%d_%d_%d", a.getPoints(), a.getGoalDiff(), a.getGoalsFor());
            String tieKeyB = String.format("%d_%d_%d", b.getPoints(), b.getGoalDiff(), b.getGoalsFor());

            if (tieKeyA.equals(tieKeyB) && h2hStatsCache.containsKey(a.getTeam().getId()) && h2hStatsCache.containsKey(b.getTeam().getId())) {
                H2HStats statsA = h2hStatsCache.get(a.getTeam().getId());
                H2HStats statsB = h2hStatsCache.get(b.getTeam().getId());
                if (statsA.pts != statsB.pts) return Integer.compare(statsB.pts, statsA.pts);
                if (statsA.gd != statsB.gd) return Integer.compare(statsB.gd, statsA.gd);
                if (statsA.gf != statsB.gf) return Integer.compare(statsB.gf, statsA.gf);
            }

            if (!Objects.equals(a.getGoalDiff(), b.getGoalDiff())) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
            if (!Objects.equals(a.getGoalsFor(), b.getGoalsFor())) return Integer.compare(b.getGoalsFor(), a.getGoalsFor());
            if (!Objects.equals(a.getFairPlayPoints(), b.getFairPlayPoints())) {
                int fpA = a.getFairPlayPoints() != null ? a.getFairPlayPoints() : 0;
                int fpB = b.getFairPlayPoints() != null ? b.getFairPlayPoints() : 0;
                if (fpA != fpB) return Integer.compare(fpB, fpA);
            }

            return a.getTeam().getName().compareTo(b.getTeam().getName());
        });

        return standings;
    }

    private H2HStats calculateH2HStats(Long teamId, List<Match> matches) {
        int pts = 0, gd = 0, gf = 0;
        for (Match m : matches) {
            boolean isHome = m.getHomeTeam().getId().equals(teamId);
            boolean isAway = m.getAwayTeam().getId().equals(teamId);
            if (!isHome && !isAway) continue;

            int teamScore = isHome ? m.getHomeScore() : m.getAwayScore();
            int oppScore = isHome ? m.getAwayScore() : m.getHomeScore();

            gf += teamScore;
            gd += (teamScore - oppScore);
            if (teamScore > oppScore) pts += 3;
            else if (teamScore == oppScore) pts += 1;
        }
        return new H2HStats(pts, gd, gf);
    }

    private record H2HStats(int pts, int gd, int gf) {}

    /**
     * Construye un mapa ultra-optimizado con las estadísticas de la vida real.
     * Formato: Map<Grupo, Map<Equipo, Map<StatName, Valor>>>
     */
    @org.springframework.cache.annotation.Cacheable("officialPoints")
    public Map<String, Map<String, Map<String, Integer>>> getOfficialPoints() {
        Map<String, Map<String, Map<String, Integer>>> result = new TreeMap<>();
        List<GroupStanding> allStandings = getAllStandings();

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

        // If positions and third-place statuses were not materialized, calculate third place elimination on the fly
        if (!hasPositions && thirdPlaceTeams.size() >= 8) {
            thirdPlaceTeams.sort((a, b) -> {
                if (!Objects.equals(a.getPoints(), b.getPoints())) return Integer.compare(b.getPoints(), a.getPoints());
                if (!Objects.equals(a.getGoalDiff(), b.getGoalDiff())) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
                if (!Objects.equals(a.getGoalsFor(), b.getGoalsFor())) return Integer.compare(b.getGoalsFor(), a.getGoalsFor());
                if (!Objects.equals(a.getFairPlayPoints(), b.getFairPlayPoints())) {
                    int fpA = a.getFairPlayPoints() != null ? a.getFairPlayPoints() : 0;
                    int fpB = b.getFairPlayPoints() != null ? b.getFairPlayPoints() : 0;
                    if (fpA != fpB) return Integer.compare(fpB, fpA);
                }
                return a.getTeam().getName().compareTo(b.getTeam().getName());
            });

            List<Match> allMatches = matchRepository.findAll();
            if (allMatches == null) allMatches = Collections.emptyList();
            List<Match> allGroupMatches = allMatches.stream()
                    .filter(m -> "group".equalsIgnoreCase(m.getRound()))
                    .toList();
            boolean isGroupStageDone = !allGroupMatches.isEmpty() && allGroupMatches.stream().allMatch(m -> Boolean.TRUE.equals(m.getFinished()));
            boolean allThirdsPlayed = thirdPlaceTeams.stream().allMatch(gs -> gs.getMatchesPlayed() != null && gs.getMatchesPlayed() >= 3);
            boolean bottomPlayed = thirdPlaceTeams.size() > 8 && thirdPlaceTeams.subList(8, thirdPlaceTeams.size()).stream().allMatch(gs -> gs.getMatchesPlayed() != null && gs.getMatchesPlayed() >= 3);

            if (isGroupStageDone || allThirdsPlayed || bottomPlayed) {
                for (int i = 8; i < thirdPlaceTeams.size(); i++) {
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
     * Recalcula la clasificación de todos los grupos a partir de los partidos reales
     * finalizados en la tabla de matches y materializa posiciones y estados matemáticos.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"standings", "officialPoints", "leaderboard"}, allEntries = true)
    @org.springframework.transaction.annotation.Transactional
    public void recalculateStandingsFromMatches() {
        if (!recalculateLock.tryLock()) {
            log.info("Recálculo de clasificaciones omitido: ya hay otra ejecución en curso.");
            return;
        }
        try {
            doRecalculateStandings();
        } finally {
            recalculateLock.unlock();
        }
    }

    private void doRecalculateStandings() {
        List<Match> groupMatches = matchRepository.findAll().stream()
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
        Map<Long, GroupStanding> existingByTeam = standingRepository.findAll().stream()
                .filter(gs -> gs.getTeam() != null && gs.getTeam().getId() != null)
                .collect(Collectors.toMap(gs -> gs.getTeam().getId(), gs -> gs, (a, b) -> a));

        List<Team> allTeams = teamRepository.findAll();
        Map<String, List<GroupStanding>> standingsByGroup = new TreeMap<>();

        for (Team team : allTeams) {
            if (team.getGroupName() == null || "-".equals(team.getGroupName()) || Team.PLACEHOLDER_NAME.equalsIgnoreCase(team.getName())) {
                continue;
            }
            String groupName = team.getGroupName().toUpperCase().trim();
            int[] stats = teamStats.getOrDefault(team.getId(), new int[5]);
            GroupStanding standing = existingByTeam.get(team.getId());
            if (standing == null) {
                standing = GroupStanding.builder()
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

        List<Match> allMatches = matchRepository.findAll();
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

        thirdPlaceTeams.sort((a, b) -> {
            int ptsA = a.getPoints() != null ? a.getPoints() : 0;
            int ptsB = b.getPoints() != null ? b.getPoints() : 0;
            if (ptsA != ptsB) return Integer.compare(ptsB, ptsA);

            int gdA = a.getGoalDiff() != null ? a.getGoalDiff() : 0;
            int gdB = b.getGoalDiff() != null ? b.getGoalDiff() : 0;
            if (gdA != gdB) return Integer.compare(gdB, gdA);

            int gfA = a.getGoalsFor() != null ? a.getGoalsFor() : 0;
            int gfB = b.getGoalsFor() != null ? b.getGoalsFor() : 0;
            if (gfA != gfB) return Integer.compare(gfB, gfA);

            int fpA = a.getFairPlayPoints() != null ? a.getFairPlayPoints() : 0;
            int fpB = b.getFairPlayPoints() != null ? b.getFairPlayPoints() : 0;
            if (fpA != fpB) return Integer.compare(fpB, fpA);

            return a.getTeam().getName().compareTo(b.getTeam().getName());
        });

        List<Match> allGroupMatches = allMatches.stream()
                .filter(m -> "group".equalsIgnoreCase(m.getRound()))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        boolean isGroupStageDone = !allGroupMatches.isEmpty() && allGroupMatches.stream().allMatch(m -> Boolean.TRUE.equals(m.getFinished()));
        boolean allThirdsPlayed = thirdPlaceTeams.size() >= 8 && thirdPlaceTeams.stream().allMatch(gs -> gs.getMatchesPlayed() >= 3);
        boolean bottomPlayed = thirdPlaceTeams.size() > 8 && thirdPlaceTeams.subList(8, thirdPlaceTeams.size()).stream().allMatch(gs -> gs.getMatchesPlayed() >= 3);

        if (isGroupStageDone || allThirdsPlayed || bottomPlayed) {
            for (int i = 8; i < thirdPlaceTeams.size(); i++) {
                GroupStanding eliminatedThird = thirdPlaceTeams.get(i);
                eliminatedThird.setStatus(-1);
            }
        }

        standingRepository.saveAll(allSortedStandings);
    }
}
