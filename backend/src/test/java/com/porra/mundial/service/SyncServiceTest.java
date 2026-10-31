package com.porra.mundial.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;

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
    @Mock private TopScorerService topScorerService;
    @Mock private LegacyFixtureRepairService legacyFixtureRepairService;

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
        when(provider.isAvailable()).thenReturn(true);
        when(matchEventProcessor.teamCache()).thenReturn(new HashMap<>());
    }

    private static boolean isEvent(JsonNode event, String id) {
        return event != null && id.equals(event.path("id").asText());
    }

    /** El evento con ese id cambia un resultado, como haría el procesador real al guardarlo. */
    private void givenTheEventChangesAResult(String eventId) {
        doAnswer(inv -> {
            inv.<MatchEventProcessor.Batch>getArgument(2).markResultsChanged();
            return null;
        }).when(matchEventProcessor).process(argThat(e -> isEvent(e, eventId)), any(), any());
    }

    /** Mundial y LaLiga con un evento cada uno; el del Mundial cambia un resultado. */
    private List<Match> givenAWorldCupResultChange() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup, laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.readTree("[{\"id\": \"liga\"}]"));
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026"))
                .thenReturn(JSON.readTree("[{\"id\": \"mundial\"}]"));
        givenTheEventChangesAResult("mundial");
        List<Match> worldCupMatches = List.of(Match.builder().id(1L).build());
        when(knockoutBracketService.worldCupMatches()).thenReturn(worldCupMatches);
        return worldCupMatches;
    }

    @Test
    void invokesOneBoundedHistoricalRepairPass() {
        when(legacyFixtureRepairService.repairBatch())
                .thenReturn(new LegacyFixtureRepairService.RepairResult(20, 18, 2));

        syncService.repairLegacyFixtures();

        verify(legacyFixtureRepairService).repairBatch();
    }

    @Test
    void actualProviderHttpFailureDegradesHealthAndNextSuccessRecovers() throws Exception {
        var client = org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        @SuppressWarnings("unchecked")
        var response = (java.net.http.HttpResponse<byte[]>) org.mockito.Mockito.mock(java.net.http.HttpResponse.class);
        when(response.statusCode()).thenReturn(503, 200);
        when(response.body()).thenReturn("{\"events\":[]}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        when(response.headers()).thenReturn(java.net.http.HttpHeaders.of(java.util.Map.of(), (key, value) -> true));
        when(client.<byte[]>send(any(java.net.http.HttpRequest.class), any())).thenReturn(response);
        var actualProvider = new com.porra.mundial.sports.EspnSportsDataProvider(client, JSON,
                io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry.ofDefaults());
        when(sportsDataProviderRegistry.getProviderForCompetition(anyString())).thenReturn(actualProvider);

        syncService.syncAll();
        assertEquals("error", syncService.getLastSyncStatus());
        assertTrue(actualProvider.isAvailable());

        syncService.syncAll();
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    void domesticProviderFailureIsNotAHealthyEmptyDay() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString()))
                .thenThrow(new java.io.IOException("HTTP 503"))
                .thenReturn(JSON.createArrayNode());

        syncService.syncAll();

        assertEquals("error", syncService.getLastSyncStatus());
        verify(provider, times(3)).fetchScoreboardEvents(anyString(), anyString());
        assertTrue(syncService.getLastErrorMessage().contains("HTTP 503"));
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
        assertEquals("error", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("Un resultado del Mundial recalcula clasificación y cuadro una sola vez por pasada, con una lectura de partidos")
    void refreshesTheWorldCupOncePerPass() throws Exception {
        List<Match> worldCupMatches = givenAWorldCupResultChange();
        when(knockoutBracketService.propagateKnockoutWinners(worldCupMatches)).thenReturn(2);

        syncService.syncAll();

        verify(knockoutBracketService, times(1)).worldCupMatches();
        verify(knockoutBracketService, times(1)).propagateKnockoutWinners(worldCupMatches);
        verify(standingsService, times(1)).recalculateStandingsFromMatches(worldCupMatches);
        verify(knockoutBracketService, never()).propagateKnockoutWinners();
        verify(standingsService, never()).recalculateStandingsFromMatches();
        verify(scoreInvalidationService).invalidateCompetition(worldCup.getId());
        verify(webSocketService, times(1)).notifyResultsChanged();
        verify(topScorerService, times(1)).refresh();
        assertEquals(2, syncService.getLastMatchesUpdated());
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("Sin resultados nuevos del Mundial no se recalculan su clasificación ni su cuadro")
    void leavesTheWorldCupAloneWhenOnlyALeagueChanges() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup, laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.readTree("[{\"id\": \"liga\"}]"));
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026")).thenReturn(JSON.createArrayNode());
        givenTheEventChangesAResult("liga");

        syncService.syncAll();

        verify(scoreInvalidationService).invalidateCompetition(laLiga.getId());
        verifyNoInteractions(topScorerService);
        verify(knockoutBracketService, never()).worldCupMatches();
        verify(knockoutBracketService, never()).propagateKnockoutWinners(anyList());
        verify(standingsService, never()).recalculateStandingsFromMatches(anyList());
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("Si falla el recálculo del Mundial, la salud lo refleja y la siguiente pasada lo repite")
    void retriesAFailedWorldCupRefreshOnTheNextPass() throws Exception {
        List<Match> worldCupMatches = givenAWorldCupResultChange();
        doThrow(new IllegalStateException("base de datos caída"))
                .doNothing()
                .when(standingsService).recalculateStandingsFromMatches(worldCupMatches);

        syncService.syncAll();
        assertEquals("error", syncService.getLastSyncStatus());
        assertEquals("FIFA World Cup 2026: base de datos caída", syncService.getLastErrorMessage());

        // La siguiente pasada no trae cambios del Mundial, pero el recálculo sigue pendiente.
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026")).thenReturn(JSON.createArrayNode());
        syncService.syncAll();
        verify(standingsService, times(2)).recalculateStandingsFromMatches(worldCupMatches);
        assertEquals("success", syncService.getLastSyncStatus());

        syncService.syncAll();
        verify(standingsService, times(2)).recalculateStandingsFromMatches(worldCupMatches);
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

    @Test
    void worldCupImportRefreshesScorersAfterCommittingItsTransaction() throws Exception {
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(worldCup));
        when(provider.fetchTeams(Competition.WORLD_CUP_EXTERNAL_ID)).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());

        syncService.importCompetitionData(2L);

        var order = org.mockito.Mockito.inOrder(transactionManager, topScorerService);
        order.verify(transactionManager).commit(any());
        order.verify(topScorerService).refresh();
    }

    @Test
    @DisplayName("Importar una liga no recalcula la clasificación ni el cuadro del Mundial")
    void importingALeagueLeavesTheWorldCupAlone() throws Exception {
        when(provider.fetchTeams("esp.1")).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.readTree("[{\"id\": \"liga\"}]"));
        givenTheEventChangesAResult("liga");

        syncService.importCompetitionData(5L);

        verify(scoreInvalidationService).invalidateCompetition(laLiga.getId());
        verify(knockoutBracketService, never()).propagateKnockoutWinners(anyList());
        verify(standingsService, never()).recalculateStandingsFromMatches(anyList());
    }

    @Test
    @DisplayName("El estado de salud resume todas las competiciones de la pasada")
    void healthAccumulatesEveryCompetition() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup, laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026"))
                .thenThrow(new IllegalStateException("ESPN no responde"));

        syncService.syncAll();

        // Falla el Mundial, que va primero: antes, el éxito de LaLiga lo tapaba.
        assertEquals("error", syncService.getLastSyncStatus());
        assertEquals("FIFA World Cup 2026: ESPN no responde", syncService.getLastErrorMessage());
    }

    @Test
    @DisplayName("Con el circuit breaker abierto no se sincroniza nada y la salud lo refleja")
    void skipsCompetitionsWhileTheCircuitBreakerIsOpen() throws Exception {
        when(provider.isAvailable()).thenReturn(false);

        syncService.syncAll();

        verify(provider, never()).fetchScoreboardEvents(anyString(), anyString());
        verify(standingsService, never()).recalculateStandingsFromMatches(anyList());
        assertEquals("circuit_breaker_open", syncService.getLastSyncStatus());
    }
}
