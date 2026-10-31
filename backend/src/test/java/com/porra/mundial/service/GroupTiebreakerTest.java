package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Criterios del artículo 13 del reglamento de la Copa Mundial de la FIFA 26. Cada caso calcula la
 * clasificación con los mismos partidos que recibe el desempate, así que los datos son coherentes.
 */
class GroupTiebreakerTest {

    private final Map<String, Team> teams = new LinkedHashMap<>();
    private final List<Match> matches = new ArrayList<>();
    private final Map<String, Integer> fairPlay = new LinkedHashMap<>();

    private Team team(String name) {
        return teams.computeIfAbsent(name, n -> Team.builder().id((long) teams.size() + 1).name(n).build());
    }

    private void play(String home, int homeGoals, int awayGoals, String away) {
        matches.add(Match.builder().homeTeam(team(home)).awayTeam(team(away))
                .homeScore(homeGoals).awayScore(awayGoals).finished(true).build());
    }

    private List<GroupStanding> standings() {
        Map<String, GroupStanding> table = new LinkedHashMap<>();
        teams.forEach((name, t) -> table.put(name, GroupStanding.builder().team(t)
                .points(0).goalDiff(0).goalsFor(0).fairPlayPoints(fairPlay.getOrDefault(name, 0)).build()));
        for (Match m : matches) {
            add(table.get(m.getHomeTeam().getName()), m.getHomeScore(), m.getAwayScore());
            add(table.get(m.getAwayTeam().getName()), m.getAwayScore(), m.getHomeScore());
        }
        return new ArrayList<>(table.values());
    }

    private static void add(GroupStanding gs, int scored, int conceded) {
        gs.setPoints(gs.getPoints() + (scored > conceded ? 3 : scored == conceded ? 1 : 0));
        gs.setGoalDiff(gs.getGoalDiff() + scored - conceded);
        gs.setGoalsFor(gs.getGoalsFor() + scored);
    }

    private List<String> ranking() {
        return names(GroupTiebreaker.sort(standings(), matches));
    }

    private static List<String> names(List<GroupStanding> standings) {
        return standings.stream().map(gs -> gs.getTeam().getName()).toList();
    }

    @Test
    void headToHeadPointsComeBeforeTheOverallGoalDifference() {
        // A y B con 6 puntos. B: +7 en total; A: -1, pero le ganó a B.
        play("A", 1, 0, "B");
        play("A", 0, 3, "C");
        play("A", 1, 0, "D");
        play("B", 4, 0, "C");
        play("B", 4, 0, "D");
        play("C", 0, 0, "D");

        assertThat(ranking()).containsExactly("A", "B", "C", "D");
    }

    @Test
    void headToHeadGoalDifferenceBreaksAThreeWayTie() {
        // Ciclo A>B>C>A: 3 puntos cada uno entre ellos; diferencia en esos partidos A +1, C 0, B -1.
        play("A", 2, 0, "B");
        play("B", 1, 0, "C");
        play("C", 1, 0, "A");
        // En total B es el de mejor diferencia (+4) y C el peor (+1).
        play("A", 1, 0, "D");
        play("B", 5, 0, "D");
        play("C", 1, 0, "D");

        assertThat(ranking()).containsExactly("A", "C", "B", "D");
    }

    @Test
    void headToHeadGoalsScoredBreakAThreeWayTie() {
        // Entre ellos: 3 puntos y diferencia 0 para los tres; goles B 4, C 3, A 2.
        play("A", 2, 1, "B");
        play("B", 3, 2, "C");
        play("C", 1, 0, "A");
        // En total A es el de mejor diferencia (+4).
        play("A", 4, 0, "D");
        play("B", 1, 0, "D");
        play("C", 1, 0, "D");

        assertThat(ranking()).containsExactly("B", "C", "A", "D");
    }

    @Test
    void theHeadToHeadIsReappliedToTheTeamsStillLevel() {
        // Mini-liga de tres: A sale primero por goles (3); B y C quedan igualados (3 pts, 0, 2 goles)
        // y se repite solo con su partido: B 1-0 C, aunque C tenga mejor diferencia total.
        play("A", 2, 1, "B");
        play("C", 2, 1, "A");
        play("B", 1, 0, "C");
        play("A", 1, 0, "D");
        play("B", 1, 0, "D");
        play("C", 5, 0, "D");

        assertThat(ranking()).containsExactly("A", "B", "C", "D");
    }

    @Test
    void overallGoalDifferenceDecidesWhenTheHeadToHeadIsLevel() {
        // A y B con 4 puntos, empataron entre ellos; A +2 y B 0 en total.
        play("A", 1, 1, "B");
        play("A", 3, 0, "C");
        play("B", 1, 0, "C");
        play("A", 0, 1, "D");
        play("B", 0, 1, "D");
        play("C", 0, 0, "D");

        assertThat(ranking()).containsExactly("D", "A", "B", "C");
    }

    @Test
    void overallGoalsScoredComeAfterTheOverallGoalDifference() {
        // A y B con 4 puntos, 2-2 entre ellos y +1 en total; A ha marcado 5 y B 4.
        play("A", 2, 2, "B");
        play("A", 3, 1, "C");
        play("B", 2, 0, "C");
        play("A", 0, 1, "D");
        play("B", 0, 1, "D");
        play("C", 1, 0, "D");

        assertThat(ranking()).containsExactly("D", "A", "B", "C");
    }

    @Test
    void fairPlayComesAfterTheGoals() {
        // A y B: 4 puntos, +1 y 2 goles; A con más tarjetas.
        play("A", 1, 1, "B");
        play("A", 1, 0, "C");
        play("B", 1, 0, "C");
        fairPlay.put("A", -5);
        fairPlay.put("B", -2);

        assertThat(ranking()).containsExactly("B", "A", "C");
    }

    @Test
    void theSecondStepDoesNotRestartTheHeadToHead() {
        // Ciclo X>Y>Z>X a 1-0: el directo no separa a nadie. X sale primero por diferencia de goles;
        // Y y Z siguen iguales en diferencia y goles y decide el fair play, aunque Y le ganó a Z.
        play("X", 1, 0, "Y");
        play("Y", 1, 0, "Z");
        play("Z", 1, 0, "X");
        play("X", 3, 0, "D");
        play("Y", 1, 0, "D");
        play("Z", 1, 0, "D");
        fairPlay.put("Y", -3);
        fairPlay.put("Z", -1);

        assertThat(ranking()).containsExactly("X", "Z", "Y", "D");
    }

    @Test
    void teamsOnlyTheFifaRankingWouldSeparateShareATierSortedByName() {
        play("B", 1, 1, "A");

        assertThat(GroupTiebreaker.tiers(standings(), matches)).hasSize(1);
        assertThat(ranking()).containsExactly("A", "B");
    }

    @Test
    void unfinishedMatchesDoNotCountForTheHeadToHead() {
        play("A", 1, 1, "B");
        List<GroupStanding> table = standings();
        table.get(0).setGoalDiff(5);
        List<Match> withLiveMatch = new ArrayList<>(matches);
        withLiveMatch.add(Match.builder().homeTeam(team("B")).awayTeam(team("A"))
                .homeScore(3).awayScore(0).finished(false).build());

        // Si contara el partido en juego, B ganaría el directo; sin él decide la diferencia de goles de A.
        assertThat(names(GroupTiebreaker.sort(table, withLiveMatch))).containsExactly("A", "B");
    }

    @Test
    void bestThirdsGoByPointsGoalDifferenceGoalsAndThenFairPlay() {
        GroupStanding morePoints = GroupStanding.builder().team(team("Más puntos")).points(6).goalDiff(-3).goalsFor(1).build();
        GroupStanding betterDiff = GroupStanding.builder().team(team("Mejor diferencia")).points(4).goalDiff(1).goalsFor(4).build();
        GroupStanding moreGoals = GroupStanding.builder().team(team("Más goles")).points(4).goalDiff(0).goalsFor(7).fairPlayPoints(-9).build();
        GroupStanding cleaner = GroupStanding.builder().team(team("Menos tarjetas")).points(4).goalDiff(0).goalsFor(2).fairPlayPoints(-3).build();
        GroupStanding dirtier = GroupStanding.builder().team(team("Más tarjetas")).points(4).goalDiff(0).goalsFor(2).fairPlayPoints(-5).build();

        List<GroupStanding> thirds = new ArrayList<>(List.of(dirtier, cleaner, moreGoals, betterDiff, morePoints));
        thirds.sort(GroupTiebreaker.THIRD_PLACE_ORDER);

        assertThat(thirds).containsExactly(morePoints, betterDiff, moreGoals, cleaner, dirtier);
    }
}
