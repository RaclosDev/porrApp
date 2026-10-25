package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MathematicalStatusCalculatorTest {

    private Team createTeam(Long id, String name) {
        return Team.builder().id(id).name(name).build();
    }

    private GroupStanding createStanding(Team team, int points, int diff, int goalsFor, int played) {
        return GroupStanding.builder()
                .team(team)
                .points(points)
                .goalDiff(diff)
                .goalsFor(goalsFor)
                .matchesPlayed(played)
                .build();
    }

    @Test
    @DisplayName("Devuelve estado 0 (abierto) para todos si hay más de 6 partidos pendientes")
    void shortCircuitsWhenMoreThanSixUnplayedMatches() {
        Team t1 = createTeam(1L, "Team A");
        Team t2 = createTeam(2L, "Team B");
        List<GroupStanding> standings = List.of(
                createStanding(t1, 0, 0, 0, 0),
                createStanding(t2, 0, 0, 0, 0)
        );

        List<Match> matches = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            matches.add(Match.builder().id((long) i).homeTeam(t1).awayTeam(t2).finished(false).build());
        }

        Map<Long, Integer> status = MathematicalStatusCalculator.calculateStatus(standings, matches);

        assertEquals(0, status.get(1L));
        assertEquals(0, status.get(2L));
    }

    @Test
    @DisplayName("Calcula equipo matemáticamente clasificado (status 1) si en su peor escenario es top 2")
    void calculatesQualifiedTeamCorrectly() {
        Team t1 = createTeam(1L, "Líder");
        Team t2 = createTeam(2L, "Segundo");
        Team t3 = createTeam(3L, "Tercero");
        Team t4 = createTeam(4L, "Cuarto");

        // Líder con 6 puntos tras 2 partidos
        // Segundo con 3, Tercero con 3, Cuarto con 0
        // Queda solo 1 jornada (2 partidos): t1 vs t4, t2 vs t3
        List<GroupStanding> standings = List.of(
                createStanding(t1, 6, 4, 5, 2),
                createStanding(t2, 3, 0, 2, 2),
                createStanding(t3, 3, 0, 2, 2),
                createStanding(t4, 0, -4, 0, 2)
        );

        // Ya jugados
        Match m1 = Match.builder().id(1L).homeTeam(t1).awayTeam(t2).finished(true).homeScore(2).awayScore(0).build();
        Match m2 = Match.builder().id(2L).homeTeam(t3).awayTeam(t4).finished(true).homeScore(2).awayScore(0).build();
        Match m3 = Match.builder().id(3L).homeTeam(t1).awayTeam(t3).finished(true).homeScore(3).awayScore(1).build();
        Match m4 = Match.builder().id(4L).homeTeam(t2).awayTeam(t4).finished(true).homeScore(2).awayScore(1).build();

        // 2 pendientes (t1 vs t4, t2 vs t3)
        Match m5 = Match.builder().id(5L).homeTeam(t1).awayTeam(t4).finished(false).build();
        Match m6 = Match.builder().id(6L).homeTeam(t2).awayTeam(t3).finished(false).build();

        List<Match> matches = List.of(m1, m2, m3, m4, m5, m6);

        Map<Long, Integer> status = MathematicalStatusCalculator.calculateStatus(standings, matches);

        // Como t2 y t3 juegan entre sí, solo uno puede llegar a 6 puntos si gana. Ambos no pueden superar a t1.
        // Por tanto t1 nunca puede bajar del 2º puesto -> CLASIFICADO (1).
        assertEquals(1, status.get(1L), "El líder con 6 pts debe estar matemáticamente clasificado");
        assertEquals(4, status.get(4L), "El cuarto con 0 pts tiene asegurado exactamente el puesto 4");
    }
}
