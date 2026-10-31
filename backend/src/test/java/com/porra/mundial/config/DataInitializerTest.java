package com.porra.mundial.config;

import com.porra.mundial.repository.*;
import com.porra.mundial.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
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
    @Mock ObjectMapper mapper;
    @Mock InitialSyncExecutor executor;
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
        when(teams.existsByGroupNameIsNotNullAndGroupNameNot("-")).thenReturn(true);

        initializer.run();

        verify(sync, after(200).never()).syncAll();
        verifyNoInteractions(standings, knockout);
    }
}
