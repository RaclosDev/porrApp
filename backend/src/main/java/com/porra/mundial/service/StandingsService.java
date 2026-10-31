package com.porra.mundial.service;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.GroupStandingRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Clasificación de los grupos del Mundial.
 * Los desempates son los del artículo 13 del reglamento, en {@link GroupTiebreaker}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StandingsService {

    private final java.util.concurrent.locks.ReentrantLock recalculateLock = new java.util.concurrent.locks.ReentrantLock();

    private final GroupStandingRepository standingRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final CompetitionRepository competitionRepository;
    private final ScoreInvalidationService scoreInvalidationService;

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
        List<Match> allMatches = worldCupMatches();
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
     * Ordena un grupo con los desempates del artículo 13 del reglamento del Mundial (ver {@link GroupTiebreaker}).
     * @param standings Equipos desordenados.
     * @param allGroupMatches Partidos del grupo, para los enfrentamientos directos entre empatados.
     * @return Clasificación ordenada.
     */
    public List<GroupStanding> sortGroupStandings(List<GroupStanding> standings, List<Match> allGroupMatches) {
        if (standings == null || standings.isEmpty()) return Collections.emptyList();
        return GroupTiebreaker.sort(standings, allGroupMatches);
    }

    /** grupo → equipo → estadística (pts, diff, gls, mp, fp, pos, status). */
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
            thirdPlaceTeams.sort(GroupTiebreaker.THIRD_PLACE_ORDER);

            List<Match> allGroupMatches = worldCupMatches().stream()
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
        recalculateWithLock(this::worldCupMatches);
    }

    /**
     * Igual que {@link #recalculateStandingsFromMatches()}, con los partidos del Mundial ya cargados:
     * la sincronización los lee una vez y los comparte con el cuadro de eliminatorias.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"standings", "officialPoints", "leaderboard"}, allEntries = true)
    @org.springframework.transaction.annotation.Transactional
    public void recalculateStandingsFromMatches(List<Match> worldCupMatches) {
        recalculateWithLock(() -> worldCupMatches);
    }

    private void recalculateWithLock(java.util.function.Supplier<List<Match>> worldCupMatches) {
        if (!recalculateLock.tryLock()) {
            log.info("Recálculo de clasificaciones omitido: ya hay otra ejecución en curso.");
            return;
        }
        try {
            doRecalculateStandings(worldCupMatches.get());
        } finally {
            recalculateLock.unlock();
        }
    }

    private void doRecalculateStandings(List<Match> allMatches) {
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
        Map<Long, GroupStanding> existingByTeam = standingRepository.findAll().stream()
                .filter(gs -> gs.getTeam() != null && gs.getTeam().getId() != null)
                .collect(Collectors.toMap(gs -> gs.getTeam().getId(), gs -> gs, (a, b) -> a));
        Map<Long, List<Object>> previousStandings = new HashMap<>();
        existingByTeam.forEach((teamId, gs) -> previousStandings.put(teamId, scoringFields(gs)));

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

        thirdPlaceTeams.sort(GroupTiebreaker.THIRD_PLACE_ORDER);

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

        boolean changed = allSortedStandings.stream()
                .anyMatch(gs -> !scoringFields(gs).equals(previousStandings.get(gs.getTeam().getId())));
        if (changed) {
            scoreInvalidationService.invalidateWorldCup();
        }
    }

    /** Partidos del Mundial: los grupos son los suyos y no se mezclan con los de ligas u otros torneos. */
    private List<Match> worldCupMatches() {
        return competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)
                .map(matchRepository::findByCompetitionId)
                .orElse(Collections.emptyList());
    }

    /** Datos de la clasificación que puntúan los cuadros: si cambia alguno, hay que recalcular las porras. */
    private static List<Object> scoringFields(GroupStanding gs) {
        return Arrays.asList(gs.getGroupName(), gs.getPoints(), gs.getGoalDiff(), gs.getGoalsFor(),
                gs.getMatchesPlayed(), gs.getFairPlayPoints(), gs.getPosition(), gs.getStatus());
    }
}
