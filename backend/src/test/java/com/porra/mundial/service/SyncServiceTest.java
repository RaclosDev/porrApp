package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.sports.SportsDataProviderRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SyncServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock private CompetitionRepository competitionRepository;
    @Mock private SportsDataProviderRegistry sportsDataProviderRegistry;
    @Mock private MatchEventProcessor matchEventProcessor;
    @Mock private KnockoutBracketService knockoutBracketService;
    @Mock private StandingsService standingsService;
    @Mock private WebSocketService webSocketService;
    @Mock private ScoreInvalidationService scoreInvalidationService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private SportsDataProvider provider;

    @InjectMocks
    private SyncService syncService;

    private final Competition worldCup = Competition.builder().id(2L).name("FIFA World Cup 2026")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).formatType("TOURNAMENT").build();
    private final Competition laLiga = Competition.builder().id(5L).name("LaLiga EA Sports")
            .externalId("esp.1").formatType("LEAGUE").build();

    @BeforeEach
    void setUp() {
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup));
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(laLiga));
        when(sportsDataProviderRegistry.getProviderForCompetition(anyString())).thenReturn(provider);
        when(provider.getProviderName()).thenReturn("ESPN");
        when(matchEventProcessor.teamCache()).thenReturn(new HashMap<>());
    }

    private static boolean isEvent(JsonNode event, String id) {
        return event != null && id.equals(event.path("id").asText());
    }

    @Test
    @DisplayName("Un evento que falla no aborta la pasada: el resto se procesa")
    void skipsBrokenEvents() throws Exception {
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026"))
                .thenReturn(JSON.readTree("[{\"id\": \"1\"}, {\"id\": \"2\"}]"));
        doThrow(new IllegalStateException("evento roto"))
                .when(matchEventProcessor).process(argThat(e -> isEvent(e, "1")), any(), any());

        syncService.syncAll();

        verify(matchEventProcessor).process(argThat(e -> isEvent(e, "2")), any(), any());
        verify(standingsService).recalculateStandingsFromMatches();
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("La importación de una competición espera a que acabe la sincronización en curso")
    void importWaitsForTheRunningSync() throws Exception {
        CountDownLatch syncStarted = new CountDownLatch(1);
        CountDownLatch releaseSync = new CountDownLatch(1);
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026")).thenAnswer(inv -> {
            syncStarted.countDown();
            releaseSync.await(5, TimeUnit.SECONDS);
            return JSON.createArrayNode();
        });
        when(provider.fetchTeams("esp.1")).thenReturn(JSON.createArrayNode());

        CompletableFuture<Void> sync = CompletableFuture.runAsync(syncService::syncAll);
        assertTrue(syncStarted.await(5, TimeUnit.SECONDS));
        CompletableFuture<SyncService.ImportResult> importing =
                CompletableFuture.supplyAsync(() -> syncService.importCompetitionData(5L));

        Thread.sleep(300);
        verify(provider, never()).fetchTeams(anyString());

        releaseSync.countDown();
        sync.get(5, TimeUnit.SECONDS);
        assertEquals("LaLiga EA Sports", importing.get(5, TimeUnit.SECONDS).competition());
        verify(provider, timeout(1000)).fetchTeams("esp.1");
    }
}
