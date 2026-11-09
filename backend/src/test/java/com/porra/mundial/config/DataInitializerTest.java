package com.porra.mundial.config;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.TournamentFormat;
import com.porra.mundial.repository.*;
import com.porra.mundial.service.account.*;
import com.porra.mundial.service.league.*;
import com.porra.mundial.service.notification.*;
import com.porra.mundial.service.prediction.*;
import com.porra.mundial.service.sync.*;
import com.porra.mundial.service.tournament.*;
import org.mockito.Answers;
import org.springframework.cache.CacheManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataInitializerTest {
    @Mock CompetitionRepository competitions;
    @Mock TeamRepository teams;
    @Mock EditionRepository editions;
    @Mock MatchRepository matches;
    @Mock SyncService sync;
    @Mock StandingsService standings;
    @Mock KnockoutBracketService knockout;
    @Mock CompetitionTeamRepository competitionTeams;
    @Spy ObjectMapper mapper = tools.jackson.databind.json.JsonMapper.builder().build();
    @Mock InitialSyncExecutor executor;
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) CacheManager cacheManager;
    @InjectMocks DataInitializer initializer;

    @Test
    void applicationReadyQueuesTheInitialSync() {
        initializer.startInitialSync();
        var work = org.mockito.ArgumentCaptor.forClass(Runnable.class);
        verify(executor).execute(work.capture());
        verifyNoInteractions(sync);

        work.getValue().run();

        verify(sync).syncAll();
    }

    @Test
    void shutdownInterruptsTheWorkerAndWaitsForItToExit() throws Exception {
        var managed = new InitialSyncExecutor();
        managed.initialize();
        var started = new java.util.concurrent.CountDownLatch(1);
        var interrupted = new java.util.concurrent.CountDownLatch(1);
        managed.execute(() -> {
            started.countDown();
            try { new java.util.concurrent.CountDownLatch(1).await(); }
            catch (InterruptedException error) {
                interrupted.countDown();
                Thread.currentThread().interrupt();
            }
        });
        org.junit.jupiter.api.Assertions.assertTrue(started.await(2, java.util.concurrent.TimeUnit.SECONDS));

        managed.shutdown();

        org.junit.jupiter.api.Assertions.assertEquals(0, interrupted.getCount());
        org.junit.jupiter.api.Assertions.assertTrue(managed.getThreadPoolExecutor().isTerminated());
    }

    @Test
    void startupLeavesAClosedTournamentAlone() {
        Competition worldCup = givenTheWorldCup();
        when(knockout.isOver(worldCup)).thenReturn(true);
        when(standings.hasStandings(worldCup)).thenReturn(true);
        initializer.startInitialSync();
        var work = org.mockito.ArgumentCaptor.forClass(Runnable.class);
        verify(executor).execute(work.capture());

        work.getValue().run();

        verify(standings, never()).recalculate(any(Competition.class));
        verify(knockout, never()).propagateKnockoutWinners(any(Competition.class));
    }

    @Test
    void startupRebuildsATournamentWhileItIsOpenOrItsStandingsAreMissing() {
        Competition worldCup = givenTheWorldCup();
        when(knockout.isOver(worldCup)).thenReturn(true);
        when(standings.hasStandings(worldCup)).thenReturn(false);
        initializer.startInitialSync();
        var work = org.mockito.ArgumentCaptor.forClass(Runnable.class);
        verify(executor).execute(work.capture());

        work.getValue().run();

        verify(standings).recalculate(worldCup);
        verify(knockout).propagateKnockoutWinners(worldCup);
    }

    /** El Mundial dado de alta, que es un torneo con grupos registrado. */
    private Competition givenTheWorldCup() {
        Competition worldCup = Competition.builder().id(2L).name("Mundial")
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitions.findByExternalIdIn(TournamentFormat.registeredExternalIds())).thenReturn(java.util.List.of(worldCup));
        return worldCup;
    }

    @Test
    void interruptionStopsSubsequentStartupDatabaseSteps() {
        initializer.startInitialSync();
        var work = org.mockito.ArgumentCaptor.forClass(Runnable.class);
        verify(executor).execute(work.capture());
        doAnswer(invocation -> { Thread.currentThread().interrupt(); return null; }).when(sync).syncAll();
        try {
            work.getValue().run();
            verifyNoInteractions(standings, knockout);
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void seedingDoesNotStartNetworkWorkBeforeItsTransactionCommits() {
        initializer.run();

        verify(sync, after(200).never()).syncAll();
        verifyNoInteractions(standings, knockout);
    }

    @Test
    void theCatalogueFileCreatesTheCompetitionsThatAreMissing() {
        when(competitions.findByExternalId(anyString())).thenAnswer(invocation -> "esp.1".equals(invocation.getArgument(0))
                ? java.util.Optional.of(Competition.builder().id(1L).externalId("esp.1").build())
                : java.util.Optional.empty());

        initializer.run();

        var saved = org.mockito.ArgumentCaptor.forClass(Competition.class);
        verify(competitions, atLeastOnce()).save(saved.capture());
        var ids = saved.getAllValues().stream().map(Competition::getExternalId).toList();
        org.junit.jupiter.api.Assertions.assertTrue(ids.containsAll(java.util.List.of(
                Competition.WORLD_CUP_EXTERNAL_ID, "uefa.champions", "eng.1", "lol.worlds",
                com.porra.mundial.sports.UfcDataProvider.COMPETITION_ID, Competition.FORMULA_ONE_EXTERNAL_ID,
                Competition.NBA_EXTERNAL_ID, Competition.NBA_REGULAR_SEASON_EXTERNAL_ID)));
        org.junit.jupiter.api.Assertions.assertFalse(ids.contains("esp.1"));
        var ufc = saved.getAllValues().stream()
                .filter(c -> com.porra.mundial.sports.UfcDataProvider.COMPETITION_ID.equals(c.getExternalId())).findFirst().orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(Competition.EVENTS_FORMAT, ufc.getFormatType());
    }

    @Test
    void aTournamentWithoutTeamsGetsTheOnesInItsSeedAndReusesTheExistingOnes() {
        Competition worldCup = Competition.builder().id(2L).name("Mundial")
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitions.findByExternalId(anyString())).thenAnswer(invocation ->
                Competition.WORLD_CUP_EXTERNAL_ID.equals(invocation.getArgument(0))
                        ? java.util.Optional.of(worldCup) : java.util.Optional.empty());
        when(competitionTeams.existsByCompetitionId(2L)).thenReturn(false);
        var spain = com.porra.mundial.model.Team.builder().id(9L).name("España").build();
        when(teams.findByName(anyString())).thenReturn(java.util.Optional.empty());
        when(teams.findByName("España")).thenReturn(java.util.Optional.of(spain));
        when(teams.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        initializer.run();

        verify(teams, times(47)).save(any());
        var links = org.mockito.ArgumentCaptor.forClass(com.porra.mundial.model.CompetitionTeam.class);
        verify(competitionTeams, times(48)).save(links.capture());
        org.junit.jupiter.api.Assertions.assertTrue(links.getAllValues().stream()
                .anyMatch(link -> link.getTeam() == spain && link.getGroupName() != null && link.getCompetition() == worldCup));
    }

    @Test
    void aTournamentThatAlreadyHasItsTeamsIsLeftAlone() {
        Competition worldCup = Competition.builder().id(2L).externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitions.findByExternalId(anyString())).thenAnswer(invocation ->
                Competition.WORLD_CUP_EXTERNAL_ID.equals(invocation.getArgument(0))
                        ? java.util.Optional.of(worldCup) : java.util.Optional.empty());
        when(competitionTeams.existsByCompetitionId(2L)).thenReturn(true);

        initializer.run();

        verifyNoInteractions(teams);
        verify(competitionTeams, never()).save(any());
    }
}
