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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StandingsServiceTest {

    @Mock
    private GroupStandingRepository standingRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private ScoreInvalidationService scoreInvalidationService;

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


        List<GroupStanding> sorted = standingsService.sortGroupStandings(
                new java.util.ArrayList<>(Arrays.asList(gsA, gsB, gsC)), List.of());

        assertEquals("TeamB", sorted.get(0).getTeam().getName());
        assertEquals("TeamA", sorted.get(1).getTeam().getName());
        assertEquals("TeamC", sorted.get(2).getTeam().getName());
    }

    @Test
    void testSortByGoalDiffWhenPointsTied() {
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(2).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(5).build();


        List<GroupStanding> sorted = standingsService.sortGroupStandings(
                new java.util.ArrayList<>(Arrays.asList(gsA, gsB)), List.of());

        assertEquals("TeamB", sorted.get(0).getTeam().getName(), "Mayor diferencia de goles gana");
    }

    @Test
    void testSortByGoalsForWhenPointsAndGoalDiffTied() {
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(2).goalsFor(2).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(2).goalsFor(4).build();


        List<GroupStanding> sorted = standingsService.sortGroupStandings(
                new java.util.ArrayList<>(Arrays.asList(gsA, gsB)), List.of());

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


        List<GroupStanding> sorted = standingsService.sortGroupStandings(
                new java.util.ArrayList<>(Arrays.asList(gsB, gsA)), List.of(h2hMatch));

        assertEquals("TeamA", sorted.get(0).getTeam().getName(), "TeamA gana por enfrentamiento directo");
    }

    @Test
    void testFairPlayTieBreaker() {
        // Empate absoluto en TODO (0-0 en su partido, mismos puntos, misma diff)
        GroupStanding gsA = GroupStanding.builder().team(teamA).points(3).goalDiff(0).goalsFor(0).fairPlayPoints(-5).build();
        GroupStanding gsB = GroupStanding.builder().team(teamB).points(3).goalDiff(0).goalsFor(0).fairPlayPoints(-2).build();

        Match h2hMatch = Match.builder()
                .homeTeam(teamA).awayTeam(teamB)
                .homeScore(0).awayScore(0)
                .finished(true)
                .build();


        List<GroupStanding> sorted = standingsService.sortGroupStandings(
                new java.util.ArrayList<>(Arrays.asList(gsA, gsB)), List.of(h2hMatch));

        assertEquals("TeamB", sorted.get(0).getTeam().getName(), "TeamB gana por desempate de Fair Play (menos puntos negativos)");
    }

    @Test
    void testEliminatedThirdsInOfficialPoints() {
        List<GroupStanding> all = new java.util.ArrayList<>();
        String[] groups = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"};
        for (int i = 0; i < 12; i++) {
            String g = groups[i];
            Team t1 = Team.builder().id(i * 3L + 100).name("T1_" + g).build();
            Team t2 = Team.builder().id(i * 3L + 101).name("T2_" + g).build();
            Team t3 = Team.builder().id(i * 3L + 102).name("T3_" + g).build();
            
            all.add(GroupStanding.builder().groupName(g).team(t1).points(9).matchesPlayed(3).build());
            all.add(GroupStanding.builder().groupName(g).team(t2).points(6).matchesPlayed(3).build());
            int thirdPts = i < 8 ? 3 : 0;
            all.add(GroupStanding.builder().groupName(g).team(t3).points(thirdPts).matchesPlayed(3).build());
        }
        
        when(standingRepository.findAllByOrderByGroupNameAsc()).thenReturn(all);
        
        var result = standingsService.getOfficialPoints();
        
        assertEquals(-1, result.get("L").get("T3_L").get("status"));
        assertEquals(-1, result.get("I").get("T3_I").get("status"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void recalculationInvalidatesBracketScoresOnlyWhenTheStandingsChange() {
        Team spain = Team.builder().id(1L).name("España").groupName("H").build();
        Team uruguay = Team.builder().id(2L).name("Uruguay").groupName("H").build();
        Match played = Match.builder().id(10L).round("group").groupName("H").homeTeam(spain).awayTeam(uruguay)
                .homeScore(2).awayScore(0).finished(true).matchDate(LocalDateTime.of(2026, 6, 15, 21, 0)).build();
        when(teamRepository.findAll()).thenReturn(List.of(spain, uruguay));
        when(matchRepository.findAll()).thenReturn(List.of(played));
        when(standingRepository.findAll()).thenReturn(List.of());

        standingsService.recalculateStandingsFromMatches();

        verify(scoreInvalidationService).invalidateWorldCup();
        ArgumentCaptor<List<GroupStanding>> saved = ArgumentCaptor.forClass(List.class);
        verify(standingRepository).saveAll(saved.capture());
        assertEquals(3, saved.getValue().get(0).getPoints());

        // Mismos partidos sobre la clasificación ya guardada: nada que recalcular.
        clearInvocations(scoreInvalidationService, standingRepository);
        when(standingRepository.findAll()).thenReturn(new ArrayList<>(saved.getValue()));

        standingsService.recalculateStandingsFromMatches();

        verify(standingRepository).saveAll(anyList());
        verify(scoreInvalidationService, never()).invalidateWorldCup();
    }
}
