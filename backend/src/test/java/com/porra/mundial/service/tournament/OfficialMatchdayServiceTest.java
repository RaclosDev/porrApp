package com.porra.mundial.service.tournament;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.sports.FootballDataClient.OfficialFixture;
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
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

    private Match match(int home, int away, Instant date) {
        return Match.builder().homeTeam(team(home)).awayTeam(team(away)).matchDate(date).round("Jornada 99").build();
    }

    private static OfficialFixture fixture(int home, int away, Instant madridDate, int matchday) {
        return new OfficialFixture(madridDate.atZone(MADRID).toInstant(), matchday, official(home), official(away));
    }

    @Test
    void assignsOfficialMatchdaysEvenForSimultaneousAndPostponedMatches() {
        Instant j1 = AppTime.fromLocal(LocalDateTime.of(2026, 8, 15, 17, 0));
        Instant j2 = AppTime.fromLocal(LocalDateTime.of(2026, 8, 22, 17, 0));
        List<Match> ours = new ArrayList<>();
        List<OfficialFixture> fixtures = new ArrayList<>();
        // Jornadas 1 y 3: cada partido en su horario, sirven para relacionar los equipos.
        for (int i = 0; i < 4; i++) {
            ours.add(match(2 * i, 2 * i + 1, j1.plus(i, ChronoUnit.HOURS)));
            fixtures.add(fixture(2 * i, 2 * i + 1, j1.plus(i, ChronoUnit.HOURS), 1));
            ours.add(match(2 * i + 1, 2 * i, j1.plus(14, ChronoUnit.DAYS).plus(i, ChronoUnit.HOURS)));
            fixtures.add(fixture(2 * i + 1, 2 * i, j1.plus(14, ChronoUnit.DAYS).plus(i, ChronoUnit.HOURS), 3));
        }
        // Jornada 2: dos partidos a la vez y uno aplazado en ESPN respecto al calendario oficial.
        Match simultaneousA = match(1, 2, j2);
        Match simultaneousB = match(3, 4, j2);
        Match postponed = match(5, 6, j2.plus(10, ChronoUnit.DAYS));
        ours.addAll(List.of(simultaneousA, simultaneousB, postponed));
        fixtures.add(fixture(3, 4, j2, 2));
        fixtures.add(fixture(1, 2, j2, 2));
        fixtures.add(fixture(5, 6, j2.plus(2, ChronoUnit.HOURS), 2));

        Map<Match, Integer> result = OfficialMatchdayService.assignMatchdays(ours, fixtures).matchdays();

        assertThat(result).hasSize(11);
        assertThat(result.get(ours.get(0))).isEqualTo(1);
        assertThat(result.get(simultaneousA)).isEqualTo(2);
        assertThat(result.get(simultaneousB)).isEqualTo(2);
        assertThat(result.get(postponed)).isEqualTo(2);
    }

    @Test
    void aScheduleMismatchDoesNotBreakTheTeamLinks() {
        Instant start = AppTime.fromLocal(LocalDateTime.of(2026, 8, 15, 17, 0));
        List<Match> ours = new ArrayList<>();
        List<OfficialFixture> fixtures = new ArrayList<>();
        for (int round = 0; round < 3; round++) {
            for (int i = 0; i < 2; i++) {
                Instant kickoff = start.plus(7L * round, ChronoUnit.DAYS).plus(i, ChronoUnit.HOURS);
                ours.add(match(2 * i, 2 * i + 1, kickoff));
                fixtures.add(fixture(2 * i, 2 * i + 1, kickoff, round + 1));
            }
        }
        // ESPN tiene un partido en un horario donde el calendario oficial pone otro distinto.
        Instant clash = start.plus(30, ChronoUnit.DAYS);
        Match moved = match(0, 2, clash.plus(3, ChronoUnit.DAYS));
        ours.add(match(1, 3, clash));
        ours.add(moved);
        fixtures.add(fixture(0, 2, clash, 4));
        fixtures.add(fixture(1, 3, clash.plus(3, ChronoUnit.DAYS), 5));

        var assignment = OfficialMatchdayService.assignMatchdays(ours, fixtures);

        assertThat(assignment.linkedTeams()).isEqualTo(4);
        assertThat(assignment.matchdays()).hasSize(8);
        assertThat(assignment.matchdays().get(moved)).isEqualTo(4);
    }

    @Test
    void linksTeamsThatNeverPlayAloneThroughKnownOpponents() {
        Instant start = AppTime.fromLocal(LocalDateTime.of(2026, 8, 15, 17, 0));
        List<Match> ours = new ArrayList<>();
        List<OfficialFixture> fixtures = new ArrayList<>();
        for (int round = 0; round < 3; round++) {
            Instant kickoff = start.plus(7L * round, ChronoUnit.DAYS);
            // Equipos 0 y 1 juegan solos en su horario; 2 y 3, siempre a la vez que otro partido
            // y con una hora distinta en cada proveedor.
            ours.add(match(0, 1, kickoff));
            fixtures.add(fixture(0, 1, kickoff, round + 1));
            ours.add(match(0, 1, kickoff.plus(3, ChronoUnit.HOURS)));
            fixtures.add(fixture(0, 1, kickoff.plus(3, ChronoUnit.HOURS), round + 1));
            ours.add(match(2, 0, kickoff.plus(1, ChronoUnit.DAYS)));
            fixtures.add(fixture(2, 0, kickoff.plus(1, ChronoUnit.DAYS).plus(2, ChronoUnit.HOURS), round + 1));
            ours.add(match(1, 3, kickoff.plus(1, ChronoUnit.DAYS)));
            fixtures.add(fixture(1, 3, kickoff.plus(1, ChronoUnit.DAYS).plus(2, ChronoUnit.HOURS), round + 1));
        }

        var assignment = OfficialMatchdayService.assignMatchdays(ours, fixtures);

        assertThat(assignment.linkedTeams()).isEqualTo(4);
        assertThat(assignment.matchdays()).hasSize(12);
    }

    @Test
    void ignoresMatchesOutsideTheOfficialSeason() {
        Instant kickoff = AppTime.fromLocal(LocalDateTime.of(2026, 8, 15, 21, 0));
        Match current = match(0, 1, kickoff);
        Match lastSeason = match(0, 1, kickoff.minus(182, ChronoUnit.DAYS));

        Map<Match, Integer> result = OfficialMatchdayService.assignMatchdays(
                List.of(current, lastSeason, match(1, 0, kickoff.plus(7, ChronoUnit.DAYS))),
                List.of(fixture(0, 1, kickoff, 1), fixture(1, 0, kickoff.plus(7, ChronoUnit.DAYS), 2))).matchdays();

        assertThat(result).hasSize(2).doesNotContainKey(lastSeason);
    }

    @Test
    void leavesAmbiguousSlotsUnassigned() {
        Instant kickoff = AppTime.fromLocal(LocalDateTime.of(2026, 8, 15, 21, 0));
        Match a = match(0, 1, kickoff);
        Match b = match(2, 3, kickoff);

        Map<Match, Integer> result = OfficialMatchdayService.assignMatchdays(
                List.of(a, b), List.of(fixture(0, 1, kickoff, 1), fixture(2, 3, kickoff, 1))).matchdays();

        assertThat(result).isEmpty();
    }
}
