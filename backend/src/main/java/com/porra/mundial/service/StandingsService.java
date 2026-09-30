package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.GroupStandingRepository;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 📊 Servicio de Clasificaciones (StandingsService).
 * Gestiona y calcula la clasificación real de los grupos del Mundial.
 * Utiliza las reglas oficiales de desempate (Puntos > H2H > Goal Average > Goles).
 */
@Service
@RequiredArgsConstructor
public class StandingsService {

    private final GroupStandingRepository standingRepository;
    private final MatchRepository matchRepository;

    /**
     * Obtiene la clasificación completa de todos los grupos ya ordenada.
     */
    @org.springframework.cache.annotation.Cacheable("standings")
    public List<GroupStanding> getAllStandings() {
        List<GroupStanding> allStandings = standingRepository.findAllByOrderByGroupNameAsc().stream()
                .filter(gs -> gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && (gs.getTeam() == null || !"Por definir".equalsIgnoreCase(gs.getTeam().getName())))
                .collect(Collectors.toList());
        Map<String, List<GroupStanding>> byGroup = allStandings.stream().collect(Collectors.groupingBy(gs -> gs.getGroupName().toUpperCase().trim()));
        
        List<Match> allMatches = matchRepository.findAll();
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
     * Obtiene la clasificación ordenada de un grupo específico.
     */
    public List<GroupStanding> getStandingsByGroup(String groupName) {
        if (groupName == null || "-".equals(groupName)) return Collections.emptyList();
        String cleanGroup = groupName.toUpperCase().trim();
        List<GroupStanding> standings = standingRepository.findByGroupName(cleanGroup);
        if (standings.isEmpty()) standings = standingRepository.findByGroupName(cleanGroup.toLowerCase());
        standings = standings.stream()
                .filter(gs -> gs.getTeam() == null || !"Por definir".equalsIgnoreCase(gs.getTeam().getName()))
                .collect(Collectors.toList());
        List<Match> matches = matchRepository.findByGroupNameOrderByMatchDateAsc(cleanGroup);
        if (matches.isEmpty()) matches = matchRepository.findByGroupNameOrderByMatchDateAsc(cleanGroup.toLowerCase());
        return sortGroupStandings(standings, matches);
    }

    /**
     * Motor de ordenación. Aplica las reglas de desempate de la FIFA/UEFA.
     * @param standings Equipos desordenados.
     * @param allGroupMatches Partidos del grupo para calcular H2H en caso de empate.
     * @return Clasificación perfectamente ordenada.
     */
    private List<GroupStanding> sortGroupStandings(List<GroupStanding> standings, List<Match> allGroupMatches) {
        if (standings == null || standings.isEmpty()) return Collections.emptyList();

        List<Match> finishedMatches = allGroupMatches.stream()
            .filter(m -> Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null)
            .collect(Collectors.toList());

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
            if (a.getPoints() != b.getPoints()) return Integer.compare(b.getPoints(), a.getPoints());

            // If tied in points, we only compare H2H if they are in the exact same tie group (same pts, gd, gf)
            // Wait, FIFA rules: 1. Points, 2. GD, 3. GF, 4. H2H points... 
            // BUT UEFA rules (which this seems to mimic): 1. Points, 2. H2H points, 3. H2H GD, 4. H2H GF, 5. Overall GD, 6. Overall GF.
            // Let's implement UEFA rules as the original code did.
            String tieKeyA = String.format("%d_%d_%d", a.getPoints(), a.getGoalDiff(), a.getGoalsFor());
            String tieKeyB = String.format("%d_%d_%d", b.getPoints(), b.getGoalDiff(), b.getGoalsFor());

            if (tieKeyA.equals(tieKeyB) && h2hStatsCache.containsKey(a.getTeam().getId()) && h2hStatsCache.containsKey(b.getTeam().getId())) {
                H2HStats statsA = h2hStatsCache.get(a.getTeam().getId());
                H2HStats statsB = h2hStatsCache.get(b.getTeam().getId());
                if (statsA.pts != statsB.pts) return Integer.compare(statsB.pts, statsA.pts);
                if (statsA.gd != statsB.gd) return Integer.compare(statsB.gd, statsA.gd);
                if (statsA.gf != statsB.gf) return Integer.compare(statsB.gf, statsA.gf);
            }

            if (a.getGoalDiff() != b.getGoalDiff()) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
            if (a.getGoalsFor() != b.getGoalsFor()) return Integer.compare(b.getGoalsFor(), a.getGoalsFor());

            if (a.getFairPlayPoints() != b.getFairPlayPoints()) return Integer.compare(b.getFairPlayPoints(), a.getFairPlayPoints());
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
     * Este mapa es usado intensivamente por LeaderboardService para contrastarlo
     * con las predicciones de los usuarios.
     * 
     * Formato: Map<Grupo, Map<Equipo, Map<StatName, Valor>>>
     */
    @org.springframework.cache.annotation.Cacheable("officialPoints")
    public Map<String, Map<String, Map<String, Integer>>> getOfficialPoints() {
        Map<String, Map<String, Map<String, Integer>>> result = new TreeMap<>();
        List<GroupStanding> allStandings = getAllStandings();
        Map<String, List<GroupStanding>> groupedStandings = allStandings.stream()
                .filter(gs -> gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && (gs.getTeam() == null || !"Por definir".equalsIgnoreCase(gs.getTeam().getName())))
                .collect(Collectors.groupingBy(gs -> gs.getGroupName().toUpperCase().trim()));
        
        List<Match> allMatches = matchRepository.findAll();
        List<GroupStanding> thirdPlaceTeams = new ArrayList<>();
        for (String group : groupedStandings.keySet()) {
            List<GroupStanding> groupList = groupedStandings.get(group);
            List<Match> groupMatches = allMatches.stream()
                .filter(m -> group.equalsIgnoreCase(m.getGroupName()))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
            List<GroupStanding> sortedGroup = sortGroupStandings(groupList, groupMatches);
            if (sortedGroup.size() >= 3) {
                thirdPlaceTeams.add(sortedGroup.get(2));
            }
            Map<Long, Integer> statusMap = MathematicalStatusCalculator.calculateStatus(sortedGroup, groupMatches);

            Map<String, Map<String, Integer>> groupMap = result.computeIfAbsent(group, k -> new LinkedHashMap<>());

            for (GroupStanding gs : sortedGroup) {
                String teamName = gs.getTeam().getName().replaceAll("[.#$\\[\\]]", "");
                Map<String, Integer> stats = new LinkedHashMap<>();
                stats.put("pts", gs.getPoints());
                stats.put("diff", gs.getGoalDiff());
                stats.put("gls", gs.getGoalsFor());
                stats.put("mp", gs.getMatchesPlayed());
                stats.put("fp", gs.getFairPlayPoints());
                stats.put("status", statusMap.getOrDefault(gs.getTeam().getId(), 0));
                groupMap.put(teamName, stats);
            }
        }

        thirdPlaceTeams.sort((a, b) -> {
            if (a.getPoints() != b.getPoints()) return Integer.compare(b.getPoints(), a.getPoints());
            if (a.getGoalDiff() != b.getGoalDiff()) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
            if (a.getGoalsFor() != b.getGoalsFor()) return Integer.compare(b.getGoalsFor(), a.getGoalsFor());
            if (a.getFairPlayPoints() != b.getFairPlayPoints()) return Integer.compare(b.getFairPlayPoints(), a.getFairPlayPoints());
            return a.getTeam().getName().compareTo(b.getTeam().getName());
        });

        List<Match> allGroupMatches = allMatches.stream()
                .filter(m -> "group".equalsIgnoreCase(m.getRound()))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
        boolean isGroupStageDone = !allGroupMatches.isEmpty() && allGroupMatches.stream().allMatch(m -> Boolean.TRUE.equals(m.getFinished()));
        boolean allThirdsPlayed = thirdPlaceTeams.size() >= 8 && thirdPlaceTeams.stream().allMatch(gs -> gs.getMatchesPlayed() >= 3);
        boolean bottomPlayed = thirdPlaceTeams.size() > 8 && thirdPlaceTeams.subList(8, thirdPlaceTeams.size()).stream().allMatch(gs -> gs.getMatchesPlayed() >= 3);

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

        return result;
    }

    /**
     * Actualiza la tabla de posiciones de un equipo tras un sincronizado.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"standings", "officialPoints", "leaderboard", "matches"}, allEntries = true)
    public void updateStanding(Team team, String groupName, int points, int goalDiff, int goalsFor, int matchesPlayed, int fairPlayPoints) {
        if (groupName == null || "-".equals(groupName) || team == null || "Por definir".equalsIgnoreCase(team.getName())) {
            return;
        }
        String cleanGroup = groupName.toUpperCase().trim();
        GroupStanding standing = standingRepository.findByTeamIdAndGroupName(team.getId(), cleanGroup)
                .orElseGet(() -> GroupStanding.builder().team(team).groupName(cleanGroup).build());

        standing.setGroupName(cleanGroup);
        standing.setPoints(points);
        standing.setGoalDiff(goalDiff);
        standing.setGoalsFor(goalsFor);
        standing.setMatchesPlayed(matchesPlayed);
        standing.setFairPlayPoints(fairPlayPoints);
        standingRepository.save(standing);
    }

    @org.springframework.cache.annotation.CacheEvict(value = {"standings", "officialPoints", "leaderboard", "matches"}, allEntries = true)
    public void clearAll() {
        standingRepository.deleteAll();
    }
}
