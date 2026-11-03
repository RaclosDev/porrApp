package com.porra.mundial.service;

import com.porra.mundial.dto.CustomMatchRequest;
import com.porra.mundial.dto.CustomResultRequest;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomCompetitionServiceTest {
    @Mock EditionRepository editions;
    @Mock TeamRepository teams;
    @Mock MatchRepository matches;
    @Mock ScoreInvalidationService scores;
    @InjectMocks CustomCompetitionService service;

    private final Long leagueId = 7L;
    private Competition competition;

    @BeforeEach
    void setup() {
        League league = League.builder().adminUser(UserAccount.builder().googleEmail("admin@example.com").build()).build();
        league.setId(leagueId);
        competition = Competition.builder().name("Torneo local").ownerLeague(league).build();
        competition.setId(9L);
        lenient().when(editions.findByLeagueIdAndStatus(leagueId, "ACTIVE"))
                .thenReturn(Optional.of(Edition.builder().league(league).competition(competition).build()));
    }

    @Test
    void nonAdminCannotAddTeams() {
        assertThrows(BusinessException.class, () -> service.addTeam(leagueId, "other@example.com", "Azules"));
        verifyNoInteractions(teams);
    }

    @Test
    void matchRejectsTeamFromAnotherCompetition() {
        Team foreign = Team.builder().name("Azules").competition(Competition.builder().build()).build();
        when(teams.findById(1L)).thenReturn(Optional.of(foreign));
        assertThrows(BusinessException.class, () -> service.addMatch(leagueId, "admin@example.com",
                new CustomMatchRequest(1L, 2L, LocalDateTime.now().plusDays(1))));
        verifyNoInteractions(matches);
    }

    @Test
    void resultUpdatesMatchAndInvalidatesScores() {
        Team home = Team.builder().name("Azules").competition(competition).build();
        Team away = Team.builder().name("Rojos").competition(competition).build();
        Match match = Match.builder().competition(competition).homeTeam(home).awayTeam(away).build();
        match.setId(12L);
        when(matches.findById(12L)).thenReturn(Optional.of(match));

        service.setResult(leagueId, 12L, "admin@example.com", new CustomResultRequest(2, 1));

        assertEquals(MatchStatusNormalized.FINISHED, match.getStatus());
        assertEquals(home, match.getWinnerTeam());
        assertEquals(2, match.getHomeScore());
        verify(scores).invalidateCompetition(competition.getId());
    }

    @Test
    void resultCannotUpdateMatchFromAnotherCompetition() {
        when(matches.findById(12L)).thenReturn(Optional.of(Match.builder()
                .competition(Competition.builder().build()).build()));
        assertThrows(BusinessException.class, () -> service.setResult(leagueId, 12L,
                "admin@example.com", new CustomResultRequest(1, 0)));
        verify(scores, never()).invalidateCompetition(any());
    }
}
