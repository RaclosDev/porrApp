package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.sports.FootballDataClient.OfficialFixture;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialMatchdayServiceTest {

    private static final ZoneId MADRID = ZoneId.of("Europe/Madrid");
    private final List<Team> teams = new ArrayList<>();

    private Team team(int index) {
        while (teams.size() <= index) {
            long id = teams.size() + 1;
            teams.add(Team.builder().id(id).name("Equipo " + id).build());
        }
        return teams.get(index);
    }

    /** Equipo propio i = equipo oficial 100 + i. */
    private static long official(int index) {
        return 100L + index;
    }

    private Match match(int home, int away, LocalDateTime date) {
        return Match.builder().homeTeam(team(home)).awayTeam(team(away)).matchDate(date).round("Jornada 99").build();
    }

    private static OfficialFixture fixture(int home, int away, LocalDateTime madridDate, int matchday) {
        return new OfficialFixture(madridDate.atZone(MADRID).toInstant(), matchday, official(home), official(away));
    }

    @Test
    void assignsOfficialMatchdaysEvenForSimultaneousAndPostponedMatches() {
        LocalDateTime j1 = LocalDateTime.of(2026, 8, 15, 17, 0);
        LocalDateTime j2 = LocalDateTime.of(2026, 8, 22, 17, 0);
        List<Match> ours = new ArrayList<>();
        List<OfficialFixture> fixtures = new ArrayList<>();
        // Jornadas 1 y 3: cada partido en su horario, sirven para relacionar los equipos.
        for (int i = 0; i < 4; i++) {
            ours.add(match(2 * i, 2 * i + 1, j1.plusHours(i)));
            fixtures.add(fixture(2 * i, 2 * i + 1, j1.plusHours(i), 1));
            ours.add(match(2 * i + 1, 2 * i, j1.plusDays(14).plusHours(i)));
            fixtures.add(fixture(2 * i + 1, 2 * i, j1.plusDays(14).plusHours(i), 3));
        }
        // Jornada 2: dos partidos a la vez y uno aplazado en ESPN respecto al calendario oficial.
        Match simultaneousA = match(1, 2, j2);
        Match simultaneousB = match(3, 4, j2);
        Match postponed = match(5, 6, j2.plusDays(10));
        ours.addAll(List.of(simultaneousA, simultaneousB, postponed));
        fixtures.add(fixture(3, 4, j2, 2));
        fixtures.add(fixture(1, 2, j2, 2));
        fixtures.add(fixture(5, 6, j2.plusHours(2), 2));

        Map<Match, Integer> result = OfficialMatchdayService.assignMatchdays(ours, fixtures).matchdays();

        assertThat(result).hasSize(11);
        assertThat(result.get(ours.get(0))).isEqualTo(1);
        assertThat(result.get(simultaneousA)).isEqualTo(2);
        assertThat(result.get(simultaneousB)).isEqualTo(2);
        assertThat(result.get(postponed)).isEqualTo(2);
    }

    @Test
    void aScheduleMismatchDoesNotBreakTheTeamLinks() {
        LocalDateTime start = LocalDateTime.of(2026, 8, 15, 17, 0);
        List<Match> ours = new ArrayList<>();
        List<OfficialFixture> fixtures = new ArrayList<>();
        for (int round = 0; round < 3; round++) {
            for (int i = 0; i < 2; i++) {
                LocalDateTime kickoff = start.plusDays(7L * round).plusHours(i);
                ours.add(match(2 * i, 2 * i + 1, kickoff));
                fixtures.add(fixture(2 * i, 2 * i + 1, kickoff, round + 1));
            }
        }
        // ESPN tiene un partido en un horario donde el calendario oficial pone otro distinto.
        LocalDateTime clash = start.plusDays(30);
        Match moved = match(0, 2, clash.plusDays(3));
        ours.add(match(1, 3, clash));
        ours.add(moved);
        fixtures.add(fixture(0, 2, clash, 4));
        fixtures.add(fixture(1, 3, clash.plusDays(3), 5));

        var assignment = OfficialMatchdayService.assignMatchdays(ours, fixtures);

        assertThat(assignment.linkedTeams()).isEqualTo(4);
        assertThat(assignment.matchdays()).hasSize(8);
        assertThat(assignment.matchdays().get(moved)).isEqualTo(4);
    }

    @Test
    void ignoresMatchesOutsideTheOfficialSeason() {
        LocalDateTime kickoff = LocalDateTime.of(2026, 8, 15, 21, 0);
        Match current = match(0, 1, kickoff);
        Match lastSeason = match(0, 1, kickoff.minusMonths(6));

        Map<Match, Integer> result = OfficialMatchdayService.assignMatchdays(
                List.of(current, lastSeason, match(1, 0, kickoff.plusDays(7))),
                List.of(fixture(0, 1, kickoff, 1), fixture(1, 0, kickoff.plusDays(7), 2))).matchdays();

        assertThat(result).hasSize(2).doesNotContainKey(lastSeason);
    }

    @Test
    void leavesAmbiguousSlotsUnassigned() {
        LocalDateTime kickoff = LocalDateTime.of(2026, 8, 15, 21, 0);
        Match a = match(0, 1, kickoff);
        Match b = match(2, 3, kickoff);

        Map<Match, Integer> result = OfficialMatchdayService.assignMatchdays(
                List.of(a, b), List.of(fixture(0, 1, kickoff, 1), fixture(2, 3, kickoff, 1))).matchdays();

        assertThat(result).isEmpty();
    }
}
