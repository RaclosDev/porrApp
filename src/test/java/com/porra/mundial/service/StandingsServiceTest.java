package com.porra.mundial.service;

import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.GroupStandingRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StandingsServiceTest {

    @Mock
    private GroupStandingRepository standingRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @InjectMocks
    private StandingsService standingsService;

    private Team teamA;
    private Team teamB;
    private Team teamC;

    @BeforeEach
    void setUp() {
        teamA = Team.builder().id(1L).name("TeamA").build();
        teamB = Team.builder().id(2L).name("TeamB").build();
        teamC = Team.builder().id(3L).name("TeamC").build();
    }

    @Test
    void testSortByPoints() {
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(6).build();
        GroupStanding gsC = GroupStanding.builder().team(teamC).points(0).build();

        when(standingRepository.findByGroupName("A")).thenReturn(Arrays.asList(gsA, gsB, gsC));
        when(matchRepository.findByGroupNameOrderByMatchDateAsc("A")).thenReturn(List.of());

        List<GroupStanding> sorted = standingsService.getStandingsByGroup("A");

        assertEquals("TeamB", sorted.get(0).getTeam().getName());
        assertEquals("TeamA", sorted.get(1).getTeam().getName());
        assertEquals("TeamC", sorted.get(2).getTeam().getName());
    }

    @Test
    void testSortByGoalDiffWhenPointsTied() {
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(2).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(5).build();

        when(standingRepository.findByGroupName("A")).thenReturn(Arrays.asList(gsA, gsB));
        when(matchRepository.findByGroupNameOrderByMatchDateAsc("A")).thenReturn(List.of());

        List<GroupStanding> sorted = standingsService.getStandingsByGroup("A");

        assertEquals("TeamB", sorted.get(0).getTeam().getName(), "Mayor diferencia de goles gana");
    }

    @Test
    void testSortByGoalsForWhenPointsAndGoalDiffTied() {
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(2).goalsFor(2).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(2).goalsFor(4).build();

        when(standingRepository.findByGroupName("A")).thenReturn(Arrays.asList(gsA, gsB));
        when(matchRepository.findByGroupNameOrderByMatchDateAsc("A")).thenReturn(List.of());

        List<GroupStanding> sorted = standingsService.getStandingsByGroup("A");

        assertEquals("TeamB", sorted.get(0).getTeam().getName(), "Mayores goles a favor gana");
    }

    @Test
    void testSortByHeadToHead() {
        // Empate absoluto en la clasificación general
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(0).goalsFor(1).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(0).goalsFor(1).build();

        // Pero TeamA ganó a TeamB 1-0 en el enfrentamiento directo
        Match h2hMatch = Match.builder()
                .homeTeam(teamA).awayTeam(teamB)
                .homeScore(1).awayScore(0)
                .finished(true)
                .build();

        when(standingRepository.findByGroupName("A")).thenReturn(Arrays.asList(gsB, gsA));
        when(matchRepository.findByGroupNameOrderByMatchDateAsc("A")).thenReturn(List.of(h2hMatch));

        List<GroupStanding> sorted = standingsService.getStandingsByGroup("A");

        assertEquals("TeamA", sorted.get(0).getTeam().getName(), "TeamA gana por enfrentamiento directo");
    }

    @Test
    void testManualTieBreaker() {
        // Empate absoluto en TODO (0-0 en su partido, mismos puntos, misma diff)
        teamA.setManualTieBreaker(0);
        teamB.setManualTieBreaker(1); // B ha sido empujado por el admin

        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(0).goalsFor(0).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(0).goalsFor(0).build();

        Match h2hMatch = Match.builder()
                .homeTeam(teamA).awayTeam(teamB)
                .homeScore(0).awayScore(0)
                .finished(true)
                .build();

        when(standingRepository.findByGroupName("A")).thenReturn(Arrays.asList(gsA, gsB));
        when(matchRepository.findByGroupNameOrderByMatchDateAsc("A")).thenReturn(List.of(h2hMatch));

        List<GroupStanding> sorted = standingsService.getStandingsByGroup("A");

        assertEquals("TeamB", sorted.get(0).getTeam().getName(), "TeamB gana por desempate manual del administrador");
    }
}
