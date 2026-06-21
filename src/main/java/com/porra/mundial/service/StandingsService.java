package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.GroupStandingRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 🥇 Servicio de Clasificaciones (La Lógica de Desempates de la FIFA)
 * Este es el archivo más inteligente de todo el proyecto.
 * Aquí ordenamos a los equipos de cada grupo para saber quién va primero,
 * aplicando la estricta normativa de desempates de la FIFA 
 * (puntos, duelo directo, goles a favor, tarjetas/manual, etc.).
 */
@Service
@RequiredArgsConstructor
public class StandingsService {

    private final GroupStandingRepository standingRepository;

    private final MatchRepository matchRepository;

    public List<GroupStanding> getAllStandings() {
        List<GroupStanding> allStandings = standingRepository.findAllByOrderByGroupNameAsc();
        Map<String, List<GroupStanding>> byGroup = allStandings.stream().collect(Collectors.groupingBy(GroupStanding::getGroupName));
        
        List<GroupStanding> sorted = new ArrayList<>();
        for (String group : byGroup.keySet().stream().sorted().collect(Collectors.toList())) {
            List<GroupStanding> groupStandings = byGroup.get(group);
            List<Match> groupMatches = matchRepository.findByGroupNameOrderByMatchDateAsc(group);
            sorted.addAll(sortGroupStandings(groupStandings, groupMatches));
        }
        return sorted;
    }

    public List<GroupStanding> getStandingsByGroup(String groupName) {
        List<GroupStanding> standings = standingRepository.findByGroupName(groupName);
        List<Match> matches = matchRepository.findByGroupNameOrderByMatchDateAsc(groupName);
        return sortGroupStandings(standings, matches);
    }

    private List<GroupStanding> sortGroupStandings(List<GroupStanding> standings, List<Match> allGroupMatches) {
        List<Match> finishedMatches = allGroupMatches.stream()
            .filter(m -> Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null)
            .collect(Collectors.toList());

        standings.sort((a, b) -> compareTeams(a, b, standings, finishedMatches));
        return standings;
    }

    private int compareTeams(GroupStanding a, GroupStanding b, List<GroupStanding> allGroupStandings, List<Match> groupMatches) {
        // [Fase 1]: Puntos totales (el que tenga más puntos, gana)
        if (a.getPoints() != b.getPoints()) {
            return Integer.compare(b.getPoints(), a.getPoints()); 
        }

        // [Empate]: Si tienen los mismos puntos, sacamos a todos los equipos que estén empatados a esos mismos puntos.
        // ¿Por qué? Porque si hay un triple empate, las reglas de la FIFA cambian y se miran los enfrentamientos
        // solo entre esos tres equipos.
        List<GroupStanding> tiedTeams = allGroupStandings.stream()
            .filter(gs -> gs.getPoints() == a.getPoints() 
                       && gs.getGoalDiff() == a.getGoalDiff() 
                       && gs.getGoalsFor() == a.getGoalsFor())
            .collect(Collectors.toList());

        List<Long> tiedTeamIds = tiedTeams.stream().map(gs -> gs.getTeam().getId()).collect(Collectors.toList());
        List<Match> h2hMatches = groupMatches.stream()
            .filter(m -> m.getHomeTeam() != null && m.getAwayTeam() != null)
            // Filtramos para quedarnos SOLO con los partidos jugados ENTRE los equipos empatados
            .filter(m -> tiedTeamIds.contains(m.getHomeTeam().getId()) && tiedTeamIds.contains(m.getAwayTeam().getId()))
            .collect(Collectors.toList());

        // Calculamos los minipuntos, minidiferencia de goles y minigoles a favor solo de esta "liguilla" de empatados
        int[] statsA = calculateStats(a.getTeam().getId(), h2hMatches);
        int[] statsB = calculateStats(b.getTeam().getId(), h2hMatches);

        // [Fase 2]: Estadísticas generales de todo el grupo (Diferencia de goles y Goles a favor)
        // La FIFA (Mundial) usa la diferencia de goles GENERAL antes que el enfrentamiento directo (a diferencia de la UEFA)
        if (a.getGoalDiff() != b.getGoalDiff()) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
        if (a.getGoalsFor() != b.getGoalsFor()) return Integer.compare(b.getGoalsFor(), a.getGoalsFor());

        // [Fase 3]: Desempate Head-to-Head (Enfrentamiento directo) entre los empatados
        // 3.a: Puntos en enfrentamientos directos
        if (statsA[0] != statsB[0]) return Integer.compare(statsB[0], statsA[0]);
        // 3.b: Diferencia de goles en enfrentamientos directos
        if (statsA[1] != statsB[1]) return Integer.compare(statsB[1], statsA[1]);
        // 3.c: Goles a favor en enfrentamientos directos
        if (statsA[2] != statsB[2]) return Integer.compare(statsB[2], statsA[2]);

        // [Fase 4]: Puntos de Fair Play (Tarjetas: Amarilla = -1, Roja = -4)
        if (a.getFairPlayPoints() != b.getFairPlayPoints()) {
            return Integer.compare(b.getFairPlayPoints(), a.getFairPlayPoints()); // Quien tenga más puntos (menos negativos) gana
        }

        // [Fase 5]: Sorteo (En nuestro caso, lo ordenamos por orden alfabético para que no dé errores raros)
        return a.getTeam().getName().compareTo(b.getTeam().getName());
    }

    private int[] calculateStats(Long teamId, List<Match> matches) {
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
        return new int[]{pts, gd, gf};
    }

    public Map<String, Map<String, Map<String, Integer>>> getOfficialPoints() {
        Map<String, Map<String, Map<String, Integer>>> result = new TreeMap<>();

        List<GroupStanding> allStandings = getAllStandings(); // Ya vienen ordenados por el nuevo algoritmo
        for (GroupStanding gs : allStandings) {
            String group = gs.getGroupName();
            String teamName = gs.getTeam().getName().replaceAll("[.#$\\[\\]]", "");

            result.computeIfAbsent(group, k -> new LinkedHashMap<>());

            Map<String, Integer> stats = new LinkedHashMap<>();
            stats.put("pts", gs.getPoints());
            stats.put("diff", gs.getGoalDiff());
            stats.put("gls", gs.getGoalsFor());
            stats.put("mp", gs.getMatchesPlayed());
            stats.put("fp", gs.getFairPlayPoints());

            result.get(group).put(teamName, stats);
        }

        return result;
    }

    public void updateStanding(Team team, String groupName, int points, int goalDiff, int goalsFor, int matchesPlayed, int fairPlayPoints) {
        GroupStanding standing = standingRepository
                .findByTeamIdAndGroupName(team.getId(), groupName)
                .orElse(GroupStanding.builder()
                        .team(team)
                        .groupName(groupName)
                        .build());

        standing.setPoints(points);
        standing.setGoalDiff(goalDiff);
        standing.setGoalsFor(goalsFor);
        standing.setMatchesPlayed(matchesPlayed);
        standing.setFairPlayPoints(fairPlayPoints);

        standingRepository.save(standing);
    }

    public void clearAll() {
        standingRepository.deleteAll();
    }
}
