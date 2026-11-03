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
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.MembershipRepository;
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
    @Mock PredictionRepository predictions;
    @Mock UserAccountRepository users;
    @Mock MembershipRepository memberships;
    @Mock CustomLockService lockService;
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
    void outsiderCannotReadCustomTeamsOrMatches() {
        assertThrows(BusinessException.class,
                () -> service.teams(leagueId, "other@example.com"));
        assertThrows(BusinessException.class,
                () -> service.matches(leagueId, "other@example.com"));
        verifyNoInteractions(teams, matches);
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
    void createsFirstRoundWithByeForOwnedTeam() {
        Team home = Team.builder().id(1L).name("Azules").competition(competition).build();
        when(teams.findById(1L)).thenReturn(Optional.of(home));
        when(predictions.findByEditionLeagueId(leagueId)).thenReturn(java.util.List.of());
        when(matches.findByCompetitionId(competition.getId())).thenReturn(java.util.List.of());
        when(matches.save(any(Match.class))).thenAnswer(invocation -> {
            Match saved = invocation.getArgument(0);
            saved.setId(12L);
            return saved;
        });

        service.addMatch(leagueId, "admin@example.com",
                new CustomMatchRequest(1L, null, null, "bracket-1"));

        verify(matches).save(argThat(match -> "bracket-1".equals(match.getRound())
                && match.getAwayTeam() == null));
    }

    @Test
    void rejectsRoundsBeyondTheFinalAndExtraMatchesInARound() {
        bracketEdition();
        Team home = Team.builder().id(1L).name("Azules").competition(competition).build();
        Team away = Team.builder().id(2L).name("Rojos").competition(competition).build();
        when(teams.findById(1L)).thenReturn(Optional.of(home));
        when(teams.findById(2L)).thenReturn(Optional.of(away));
        Match first = Match.builder().round("bracket-1").build();
        Match second = Match.builder().round("bracket-1").build();
        when(matches.findByCompetitionId(competition.getId())).thenReturn(java.util.List.of(first, second));

        assertThrows(BusinessException.class, () -> service.addMatch(leagueId, "admin@example.com",
                new CustomMatchRequest(1L, 2L, null, "bracket-3")));

        when(matches.findByCompetitionId(competition.getId())).thenReturn(java.util.List.of(
                first, second, Match.builder().round("bracket-2").build()));
        assertThrows(BusinessException.class, () -> service.addMatch(leagueId, "admin@example.com",
                new CustomMatchRequest(1L, 2L, null, "bracket-2")));
        verify(matches, never()).save(any());
    }

    @Test
    void rejectsTheSameTeamTwiceInALaterRound() {
        bracketEdition();
        Team home = Team.builder().id(1L).name("Azules").competition(competition).build();
        Team away = Team.builder().id(2L).name("Rojos").competition(competition).build();
        when(teams.findById(1L)).thenReturn(Optional.of(home));
        when(teams.findById(2L)).thenReturn(Optional.of(away));
        when(matches.findByCompetitionId(competition.getId())).thenReturn(java.util.List.of(
                Match.builder().round("bracket-1").build(),
                Match.builder().round("bracket-1").build(),
                Match.builder().round("bracket-1").build(),
                Match.builder().round("bracket-1").build(),
                Match.builder().round("bracket-2").homeTeam(home).build()));

        assertThrows(BusinessException.class, () -> service.addMatch(leagueId, "admin@example.com",
                new CustomMatchRequest(1L, 2L, null, "bracket-2")));
        verify(matches, never()).save(any());
    }

    private Edition bracketEdition() {
        Edition edition = Edition.builder().league(competition.getOwnerLeague()).competition(competition)
                .poolFormat(com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY).build();
        when(editions.findByLeagueIdAndStatus(leagueId, "ACTIVE")).thenReturn(Optional.of(edition));
        lenient().when(predictions.findByEditionLeagueId(leagueId)).thenReturn(java.util.List.of());
        return edition;
    }

    @Test
    void firstMatchModeFollowsTheFirstMatchMinusTheMargin() {
        Edition edition = bracketEdition();
        LocalDateTime lock = LocalDateTime.now().plusDays(3);
        when(lockService.firstMatchLock(edition)).thenReturn(lock);

        service.setLockConfig(leagueId, "admin@example.com", com.porra.mundial.model.PredictionLockMode.FIRST_MATCH,
                2 * 24 * 60, null);

        assertEquals(com.porra.mundial.model.PredictionLockMode.FIRST_MATCH, edition.getLockMode());
        assertEquals(2 * 24 * 60, edition.getLockOffsetMinutes());
        assertEquals(lock, edition.getLockDate());
    }

    @Test
    void progressiveModesHaveNoSingleLockDate() {
        Edition edition = bracketEdition();
        edition.setLockDate(LocalDateTime.now().plusDays(1));

        service.setLockConfig(leagueId, "admin@example.com", com.porra.mundial.model.PredictionLockMode.PER_MATCH, 30, null);

        assertNull(edition.getLockDate());
        assertEquals(30, edition.getLockOffsetMinutes());
    }

    @Test
    void rejectsMarginsOutsideZeroToThirtyDaysAndChangesAfterPredictions() {
        Edition edition = bracketEdition();
        assertThrows(BusinessException.class, () -> service.setLockConfig(leagueId, "admin@example.com",
                com.porra.mundial.model.PredictionLockMode.PER_ROUND, 30 * 24 * 60 + 1, null));
        assertThrows(BusinessException.class, () -> service.setLockConfig(leagueId, "admin@example.com",
                com.porra.mundial.model.PredictionLockMode.PER_ROUND, -5, null));
        when(predictions.findByEditionLeagueId(leagueId)).thenReturn(java.util.List.of(new com.porra.mundial.model.Prediction()));
        assertThrows(BusinessException.class, () -> service.setLockConfig(leagueId, "admin@example.com",
                com.porra.mundial.model.PredictionLockMode.PER_ROUND, 0, null));
        assertEquals(com.porra.mundial.model.PredictionLockMode.FIXED_DATE, edition.getLockMode());
    }

    @Test
    void adminChangesTeamLogoEvenAfterPredictions() {
        Team selected = Team.builder().id(1L).name("T1").competition(competition).build();
        when(teams.findById(1L)).thenReturn(Optional.of(selected));

        Team updated = service.setTeamLogo(leagueId, 1L, "admin@example.com", "  https://cdn.example.com/t1.png ");

        assertEquals("https://cdn.example.com/t1.png", updated.getLogoUrl());
        verifyNoInteractions(predictions);
        assertNull(service.setTeamLogo(leagueId, 1L, "admin@example.com", " ").getLogoUrl());
    }

    @Test
    void rejectsLogosThatAreNotHttpsOrFromOtherUsers() {
        Team selected = Team.builder().id(1L).name("T1").competition(competition).build();
        lenient().when(teams.findById(1L)).thenReturn(Optional.of(selected));

        for (String url : java.util.List.of("http://cdn.example.com/t1.png", "javascript:alert(1)", "/img/t1.png")) {
            assertThrows(BusinessException.class, () -> service.setTeamLogo(leagueId, 1L, "admin@example.com", url));
        }
        assertThrows(BusinessException.class,
                () -> service.setTeamLogo(leagueId, 1L, "other@example.com", "https://cdn.example.com/t1.png"));
        assertNull(selected.getLogoUrl());
    }

    @Test
    void cannotDeleteTeamUsedInAConfiguredMatch() {
        Team selected = Team.builder().id(1L).name("Azules").competition(competition).build();
        when(teams.findById(1L)).thenReturn(Optional.of(selected));
        when(predictions.findByEditionLeagueId(leagueId)).thenReturn(java.util.List.of());
        when(matches.findByCompetitionId(competition.getId())).thenReturn(java.util.List.of(
                Match.builder().homeTeam(selected).competition(competition).build()));

        assertThrows(BusinessException.class,
                () -> service.deleteTeam(leagueId, 1L, "admin@example.com"));
        verify(teams, never()).delete(any());
    }

    @Test
    void setsFutureDeadlineBeforeAnyonePredicts() {
        League league = competition.getOwnerLeague();
        Edition edition = Edition.builder().league(league).competition(competition)
                .poolFormat(com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY).build();
        when(editions.findByLeagueIdAndStatus(leagueId, "ACTIVE")).thenReturn(Optional.of(edition));
        when(predictions.findByEditionLeagueId(leagueId)).thenReturn(java.util.List.of());
        LocalDateTime deadline = LocalDateTime.now().plusDays(2);

        service.setLockDate(leagueId, "admin@example.com", deadline);

        assertEquals(deadline, edition.getLockDate());
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
