package app.porrapp.service.sync;

import app.porrapp.service.tournament.StandingsService;
import app.porrapp.service.tournament.KnockoutBracketService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.prediction.CustomLockService;
import app.porrapp.service.notification.WebSocketService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import app.porrapp.model.Competition;
import app.porrapp.model.Match;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.sports.SportsDataProviderRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
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
import static org.mockito.ArgumentMatchers.eq;
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
    @Mock private app.porrapp.repository.EditionRepository editionRepository;
    @Mock private SportsDataProviderRegistry sportsDataProviderRegistry;
    @Mock private MatchEventProcessor matchEventProcessor;
    @Mock private KnockoutBracketService knockoutBracketService;
    @Mock private StandingsService standingsService;
    @Mock private WebSocketService webSocketService;
    @Mock private ScoreInvalidationService scoreInvalidationService;
    @Mock private CustomLockService customLockService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private SportsDataProvider provider;
    @Mock private TopScorerService topScorerService;
    @Mock private LegacyFixtureRepairService legacyFixtureRepairService;
    @Mock private app.porrapp.repository.MatchRepository matchRepository;
    @Mock private app.porrapp.service.tournament.OfficialMatchdayService officialMatchdayService;
    @Mock private app.porrapp.service.formulaone.FormulaOneSyncService formulaOneSyncService;
    @Mock private CompetitionSeasonService seasonService;

    @Spy private SyncLock syncLock = new SyncLock();

    @InjectMocks
    private SyncService syncService;

    /** Comparte el cerrojo con la sincronización, como en la aplicación. */
    private CompetitionImportService importService;

    private final Competition worldCup = Competition.builder().id(2L).name("FIFA World Cup 2026")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).formatType("TOURNAMENT").build();
    private final Competition laLiga = Competition.builder().id(5L).name("LaLiga EA Sports")
            .externalId("esp.1").formatType("LEAGUE").build();

    @BeforeEach
    void setUp() {
        importService = new CompetitionImportService(competitionRepository, sportsDataProviderRegistry,
                matchEventProcessor, knockoutBracketService, standingsService, webSocketService,
                scoreInvalidationService, transactionManager, topScorerService, customLockService, syncLock,
                officialMatchdayService, formulaOneSyncService, seasonService);
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup));
        // Las competiciones de estos tests tienen todas alguna liga activa, salvo que el test diga otra cosa.
        when(editionRepository.findCompetitionIdsInUse()).thenReturn(List.of(2L, 5L, 19L));
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(laLiga));
        when(sportsDataProviderRegistry.findProviderForCompetition(anyString())).thenReturn(java.util.Optional.of(provider));
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
        when(knockoutBracketService.matchesOf(worldCup)).thenReturn(worldCupMatches);
        return worldCupMatches;
    }

    @Test
    void fullSyncDoesNotAskForAWorldCupThatIsOver() throws Exception {
        when(knockoutBracketService.isOver(worldCup)).thenReturn(true);

        syncService.syncAll();

        verify(provider, never()).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
        verify(knockoutBracketService, never()).matchesOf(worldCup);
        assertEquals(SyncService.STATUS_SUCCESS, syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("Una temporada archivada no se sincroniza, ni entera ni en directo, aunque tenga ligas")
    void archivedSeasonsAreNeverSynced() throws Exception {
        Competition archived = Competition.builder().id(19L).name("LaLiga EA Sports").externalId("esp.1")
                .season("2025/26").archivedAt(Instant.now()).build();
        when(competitionRepository.findAll()).thenReturn(List.of(archived));
        when(matchRepository.findCompetitionIdsWithOpenMatchesBetween(any(), any())).thenReturn(List.of(19L));
        when(competitionRepository.findAllById(List.of(19L))).thenReturn(List.of(archived));

        syncService.syncAll();
        syncService.syncLive();

        verifyNoInteractions(provider);
    }

    @Test
    @DisplayName("La importación anota la temporada que da el proveedor antes de guardar lo descargado")
    void importAnnotatesTheProviderSeason() throws Exception {
        when(provider.fetchSeasonWindow("esp.1"))
                .thenReturn(new SportsDataProvider.SeasonWindow("2026-08-14T04:00Z", "2027-06-01T03:59Z"));
        when(provider.fetchTeams("esp.1")).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.readTree("[{\"id\": \"liga\"}]"));

        importService.importCompetitionData(5L);

        var order = org.mockito.Mockito.inOrder(seasonService, matchEventProcessor);
        order.verify(seasonService).annotate(5L, new CompetitionSeasonService.Season("2026/27",
                Instant.parse("2026-08-14T04:00:00Z"), Instant.parse("2027-06-01T03:59:00Z")));
        order.verify(matchEventProcessor).process(any(), any(), any());
    }

    @Test
    @DisplayName("Si el proveedor no da temporada, la importación sigue y no hay nada que anotar")
    void importWithoutAProviderSeasonAnnotatesNothing() throws Exception {
        when(provider.fetchTeams("esp.1")).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());

        importService.importCompetitionData(5L);

        verify(seasonService).annotate(5L, null);
    }

    @Test
    @DisplayName("La temporada de la Fórmula 1 es el año natural, y no poder anotarla no estropea la carga")
    void formulaOneSeasonIsTheCalendarYear() throws Exception {
        Competition formulaOne = Competition.builder().id(30L).name("Fórmula 1")
                .externalId(Competition.FORMULA_ONE_EXTERNAL_ID).formatType("RACE").build();
        when(competitionRepository.findById(30L)).thenReturn(Optional.of(formulaOne));
        when(formulaOneSyncService.importSeason(formulaOne))
                .thenReturn(new app.porrapp.service.formulaone.FormulaOneSyncService.SyncResult(0, 0, false));
        int year = java.time.LocalDate.now(app.porrapp.util.AppTime.ZONE).getYear();
        when(seasonService.annotate(30L, CompetitionSeasonService.Season.ofYear(year)))
                .thenThrow(new IllegalStateException("sin base de datos"));

        importService.importCompetitionData(30L);

        verify(seasonService).annotate(30L, CompetitionSeasonService.Season.ofYear(year));
    }

    @Test
    @DisplayName("La pasada completa solo pide las competiciones que juega alguna liga activa")
    void fullSyncSkipsCompetitionsNobodyPlays() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup, laLiga));
        when(editionRepository.findCompetitionIdsInUse()).thenReturn(List.of(5L));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());

        syncService.syncAll();

        verify(provider, never()).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
        verify(provider, org.mockito.Mockito.atLeastOnce()).fetchScoreboardEvents(eq("esp.1"), anyString());
        assertEquals(SyncService.STATUS_SUCCESS, syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("La pasada en directo no pide los partidos en juego de una competición sin ligas")
    void liveSyncSkipsCompetitionsNobodyPlays() {
        when(matchRepository.findCompetitionIdsWithOpenMatchesBetween(any(), any())).thenReturn(List.of(5L));
        when(editionRepository.findCompetitionIdsInUse()).thenReturn(List.of(2L));

        syncService.syncLive();

        verifyNoInteractions(provider);
        verify(competitionRepository, never()).findAllById(any());
    }

    @Test
    void liveSyncDoesNothingWithoutMatchesInPlay() {
        when(matchRepository.findCompetitionIdsWithOpenMatchesBetween(any(), any())).thenReturn(List.of());

        syncService.syncLive();

        verifyNoInteractions(provider);
        verify(competitionRepository, never()).findAllById(any());
    }

    @Test
    void liveSyncOnlyFetchesTodayAndYesterdayOfCompetitionsInPlay() throws Exception {
        when(matchRepository.findCompetitionIdsWithOpenMatchesBetween(any(), any())).thenReturn(List.of(5L));
        when(competitionRepository.findAllById(List.of(5L))).thenReturn(List.of(laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());

        syncService.syncLive();

        verify(provider, times(2)).fetchScoreboardEvents(eq("esp.1"), anyString());
        verify(provider, never()).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
        // La pasada en directo no sustituye al estado de salud de la pasada completa.
        org.junit.jupiter.api.Assertions.assertEquals("INITIALIZING", syncService.getLastSyncStatus());
    }

    @Test
    void oversizedImportNeverStartsWriting() throws Exception {
        var oversized = JSON.createArrayNode();
        for (int i = 0; i < 1001; i++) oversized.addObject();
        when(provider.fetchTeams("esp.1")).thenReturn(oversized);

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> importService.importCompetitionData(5L));

        verifyNoInteractions(transactionManager);
        verify(matchEventProcessor, never()).importTeams(any(), any());
    }

    @Test
    void interruptedDownloadPreservesCancellationAndMakesNoWrites() throws Exception {
        when(provider.fetchTeams("esp.1")).thenThrow(new InterruptedException("closing"));
        try {
            org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                    () -> importService.importCompetitionData(5L));
            assertTrue(Thread.currentThread().isInterrupted());
            verifyNoInteractions(transactionManager);
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void downloadsTheWholeImportBeforeOpeningItsWriteTransaction() throws Exception {
        when(provider.fetchTeams("esp.1")).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());

        importService.importCompetitionData(5L);

        var order = org.mockito.Mockito.inOrder(provider, transactionManager);
        order.verify(provider).fetchTeams("esp.1");
        order.verify(provider, org.mockito.Mockito.atLeastOnce()).fetchScoreboardEvents(anyString(), anyString());
        order.verify(transactionManager).getTransaction(any());
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
        var actualProvider = new app.porrapp.sports.EspnSportsDataProvider(client, JSON,
                io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry.ofDefaults());
        when(sportsDataProviderRegistry.findProviderForCompetition(anyString())).thenReturn(java.util.Optional.of(actualProvider));

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
        verify(provider, times(3 + SyncService.UPCOMING_DAYS - 1)).fetchScoreboardEvents(anyString(), anyString());
        assertTrue(syncService.getLastErrorMessage().contains("HTTP 503"));
    }

    @Test
    @DisplayName("Worlds de LoL repasa la temporada en curso, sin mezclar ediciones anteriores")
    void lolCompetitionsSyncTheWholeSchedule() throws Exception {
        Competition worlds = Competition.builder().id(19L).name("Worlds")
                .externalId("lol.worlds").formatType("TOURNAMENT").build();
        when(competitionRepository.findAll()).thenReturn(List.of(worlds));
        String season = String.valueOf(java.time.LocalDate.now().getYear());
        when(provider.fetchScoreboardEvents("lol.worlds", season)).thenReturn(JSON.createArrayNode());

        syncService.syncAll();

        verify(provider, times(1)).fetchScoreboardEvents("lol.worlds", season);
        verify(provider, times(1)).fetchScoreboardEvents(anyString(), anyString());
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("Las ligas traen las dos próximas semanas, pero no en cada pasada")
    void leaguesFetchUpcomingDaysPeriodically() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());
        String lastDay = java.time.LocalDate.now().plusDays(SyncService.UPCOMING_DAYS)
                .format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

        syncService.syncAll();
        syncService.syncAll();

        verify(provider, times(1)).fetchScoreboardEvents("esp.1", lastDay);
        verify(provider, times(3 * 2 + SyncService.UPCOMING_DAYS - 1)).fetchScoreboardEvents(anyString(), anyString());
        assertEquals("success", syncService.getLastSyncStatus());
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
        when(knockoutBracketService.propagateKnockoutWinners(worldCup, worldCupMatches)).thenReturn(2);

        syncService.syncAll();

        verify(knockoutBracketService, times(1)).matchesOf(worldCup);
        verify(knockoutBracketService, times(1)).propagateKnockoutWinners(worldCup, worldCupMatches);
        verify(standingsService, times(1)).recalculate(worldCup, worldCupMatches);
        verify(knockoutBracketService, never()).propagateKnockoutWinners(worldCup);
        verify(standingsService, never()).recalculate(worldCup);
        verify(scoreInvalidationService).invalidateCompetition(worldCup.getId());
        verify(webSocketService, times(1)).notifyResultsChanged();
        verify(topScorerService, times(1)).refresh(worldCup);
        assertEquals(2, syncService.getLastMatchesUpdated());
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("El cambio de una liga avisa solo de su competición y vacía solo las clasificaciones de sus ligas")
    void aLeagueChangeIsAnnouncedWithItsCompetitionOnly() throws Exception {
        when(competitionRepository.findAll()).thenReturn(List.of(worldCup, laLiga));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.readTree("[{\"id\": \"liga\"}]"));
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026")).thenReturn(JSON.createArrayNode());
        doAnswer(inv -> {
            org.springframework.test.util.ReflectionTestUtils.setField(
                    inv.<MatchEventProcessor.Batch>getArgument(2), "matchesUpdated", 1);
            return null;
        }).when(matchEventProcessor).process(argThat(e -> isEvent(e, "liga")), any(), any());

        syncService.syncAll();

        verify(scoreInvalidationService).evictLeaderboardsAfterCommit(java.util.Set.of(laLiga.getId()));
        verify(webSocketService).notifyResultsChanged(java.util.Set.of(laLiga.getId()));
        verify(webSocketService, never()).notifyResultsChanged();
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
        verify(knockoutBracketService, never()).matchesOf(worldCup);
        verify(knockoutBracketService, never()).propagateKnockoutWinners(any(), anyList());
        verify(standingsService, never()).recalculate(any(), anyList());
        assertEquals("success", syncService.getLastSyncStatus());
    }

    @Test
    @DisplayName("Si falla el recálculo del Mundial, la salud lo refleja y la siguiente pasada lo repite")
    void retriesAFailedWorldCupRefreshOnTheNextPass() throws Exception {
        List<Match> worldCupMatches = givenAWorldCupResultChange();
        doThrow(new IllegalStateException("base de datos caída"))
                .doNothing()
                .when(standingsService).recalculate(worldCup, worldCupMatches);

        syncService.syncAll();
        assertEquals("error", syncService.getLastSyncStatus());
        assertEquals(SyncService.TOURNAMENT_REFRESH + worldCup.getName() + ": base de datos caída", syncService.getLastErrorMessage());

        // La siguiente pasada no trae cambios del Mundial, pero el recálculo sigue pendiente.
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026")).thenReturn(JSON.createArrayNode());
        syncService.syncAll();
        verify(standingsService, times(2)).recalculate(worldCup, worldCupMatches);
        assertEquals("success", syncService.getLastSyncStatus());

        syncService.syncAll();
        verify(standingsService, times(2)).recalculate(worldCup, worldCupMatches);
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
        when(provider.fetchScoreboardEvents(eq("esp.1"), anyString())).thenReturn(JSON.createArrayNode());

        CompletableFuture<Void> sync = CompletableFuture.runAsync(syncService::syncAll);
        assertTrue(syncStarted.await(5, TimeUnit.SECONDS));
        CompletableFuture<CompetitionImportService.ImportResult> importing =
                CompletableFuture.supplyAsync(() -> importService.importCompetitionData(5L));

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

        importService.importCompetitionData(2L);

        var order = org.mockito.Mockito.inOrder(transactionManager, topScorerService);
        order.verify(transactionManager).commit(any());
        order.verify(topScorerService).refresh(worldCup);
    }

    @Test
    @DisplayName("Importar una liga no recalcula la clasificación ni el cuadro del Mundial")
    void importingALeagueLeavesTheWorldCupAlone() throws Exception {
        when(provider.fetchTeams("esp.1")).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.readTree("[{\"id\": \"liga\"}]"));
        givenTheEventChangesAResult("liga");

        importService.importCompetitionData(5L);

        verify(scoreInvalidationService).invalidateCompetition(laLiga.getId());
        verify(knockoutBracketService, never()).propagateKnockoutWinners(any(), anyList());
        verify(standingsService, never()).recalculate(any(), anyList());
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
        verify(standingsService, never()).recalculate(any(), anyList());
        assertEquals("circuit_breaker_open", syncService.getLastSyncStatus());
    }
}
