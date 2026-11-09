package app.porrapp.service.tournament;

import app.porrapp.model.Competition;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.notification.WebSocketService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import app.porrapp.sports.EspnSportsDataProvider;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.dto.TopScorerDTO;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TopScorerServiceTest {

    @Mock
    private WebSocketService webSocketService;

    @Mock
    private HttpClient httpClient;

    @Mock
    private SportsDataProvider sportsDataProvider;

    @Mock
    private ScoreInvalidationService scoreInvalidationService;

    @Mock
    private KnockoutBracketService knockoutBracketService;

    @Mock
    private TopScorerStore topScorerStore;

    @Mock
    private CompetitionRepository competitionRepository;

    @Mock
    private EditionRepository editionRepository;

    @Mock
    private MatchRepository matchRepository;

    private final Competition worldCup = Competition.builder().id(2L).name("Mundial")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();

    private ObjectMapper objectMapper;
    private TopScorerService topScorerService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        topScorerService = new TopScorerService(objectMapper, webSocketService, httpClient, sportsDataProvider,
                scoreInvalidationService, knockoutBracketService, topScorerStore, competitionRepository,
                editionRepository, matchRepository);
        lenient().when(competitionRepository.findByExternalIdIn(any())).thenReturn(List.of(worldCup));
    }

    @Test
    @DisplayName("Tras arrancar con el torneo cerrado valen los goleadores guardados: ni proveedor ni recálculo")
    void storedScorersAreUsedAfterARestartWithoutAskingTheProvider() {
        List<TopScorerDTO> stored = List.of(new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 8, "F", "1", "Francia", ""));
        when(topScorerStore.load(2L)).thenReturn(stored);
        when(knockoutBracketService.isOver(worldCup)).thenReturn(true);

        topScorerService.scheduledRefresh();
        topScorerService.scheduledRefresh();

        assertEquals(stored, topScorerService.getTopScorers(worldCup));
        verifyNoInteractions(sportsDataProvider, scoreInvalidationService, webSocketService);
        verify(topScorerStore, times(1)).load(2L);
        verify(topScorerStore, never()).replace(anyLong(), any());
    }

    @Test
    @DisplayName("Los goleadores se guardan solo cuando cambian, y un fallo al guardar no los pierde")
    void scorersAreStoredOnlyWhenTheyChange() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString()))
                .thenReturn(goalBy("Kylian Mbappé"));
        doThrow(new IllegalStateException("base de datos caída")).when(topScorerStore).replace(anyLong(), any());

        topScorerService.refresh(worldCup);
        topScorerService.refresh(worldCup);

        verify(topScorerStore, times(1)).replace(eq(2L), eq(topScorerService.getTopScorers(worldCup)));
        assertEquals(1, topScorerService.getTopScorers(worldCup).size());
    }

    @Test
    @DisplayName("Si no se pueden leer los guardados, se reintenta en la siguiente consulta")
    void aFailedReadOfStoredScorersIsRetried() {
        List<TopScorerDTO> stored = List.of(new TopScorerDTO("Harry Kane", "H. Kane", 6, "F", "2", "Inglaterra", ""));
        when(topScorerStore.load(2L))
                .thenThrow(new IllegalStateException("base de datos caída"))
                .thenReturn(stored);

        assertTrue(topScorerService.getTopScorers(worldCup).isEmpty());
        assertEquals(stored, topScorerService.getTopScorers(worldCup));
    }

    @Test
    void overlappingRefreshDoesNotQueueAnotherProviderRequest() throws Exception {
        var started = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenAnswer(invocation -> {
            started.countDown();
            if (!release.await(2, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("timeout");
            return objectMapper.createArrayNode();
        });
        var running = java.util.concurrent.CompletableFuture.runAsync(() -> topScorerService.refresh(worldCup));
        assertTrue(started.await(2, java.util.concurrent.TimeUnit.SECONDS));
        try {
            assertTimeoutPreemptively(java.time.Duration.ofMillis(500), () -> topScorerService.refresh(worldCup));
        } finally {
            release.countDown();
            running.get(2, java.util.concurrent.TimeUnit.SECONDS);
        }
        verify(sportsDataProvider, times(1)).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
    }

    @Test
    void missingPlayerImageIsLookedUpOnceAcrossGoalsAndRefreshes() throws Exception {
        JsonNode goal = goalBy("New Scorer");
        var events = objectMapper.createArrayNode().add(goal.get(0)).add(goal.get(0));
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenReturn(events);
        @SuppressWarnings("unchecked")
        var response = (java.net.http.HttpResponse<String>) mock(java.net.http.HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{}");
        when(httpClient.<String>send(any(java.net.http.HttpRequest.class), any())).thenReturn(response);

        topScorerService.refresh(worldCup);
        topScorerService.refresh(worldCup);

        assertEquals(2, topScorerService.getTopScorers(worldCup).getFirst().goals());
        verify(httpClient, times(2)).send(any(java.net.http.HttpRequest.class), any());
    }

    @Test
    void scheduledRefreshStopsAskingOnceTheWorldCupIsOverAndScorersAreLoaded() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString()))
                .thenReturn(goalBy("Kylian Mbappé"));
        when(knockoutBracketService.isOver(worldCup)).thenReturn(true);

        // Tras arrancar no hay goleadores en memoria: la primera pasada los carga aunque el torneo haya acabado.
        topScorerService.scheduledRefresh();
        topScorerService.scheduledRefresh();
        topScorerService.scheduledRefresh();

        assertEquals(1, topScorerService.getTopScorers(worldCup).size());
        verify(sportsDataProvider, times(1)).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
    }

    @Test
    void scheduledRefreshKeepsAskingWhileTheWorldCupIsBeingPlayed() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString()))
                .thenReturn(goalBy("Kylian Mbappé"));
        when(knockoutBracketService.isOver(worldCup)).thenReturn(false);

        topScorerService.scheduledRefresh();
        topScorerService.scheduledRefresh();

        verify(sportsDataProvider, times(2)).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
    }

    @Test
    @DisplayName("Debe resolver la inyeccion de Spring con el proveedor ESPN registrado")
    void springContext_resolvesSportsDataProviderWithoutAmbiguity() {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.register(TestContextConfig.class);
        context.register(EspnSportsDataProvider.class);
        context.register(TopScorerService.class);
        context.refresh();

        TopScorerService resolvedService = context.getBean(TopScorerService.class);
        assertNotNull(resolvedService);

        SportsDataProvider resolvedDefaultProvider = context.getBean(SportsDataProvider.class);
        assertTrue(resolvedDefaultProvider instanceof EspnSportsDataProvider,
                "El proveedor primario por defecto debe ser EspnSportsDataProvider");

        context.close();
    }

    @Test
    @DisplayName("Debe procesar eventos y calcular la lista de goleadores ordenada por goles")
    void refresh_processesEventsAndOrdersScorers() throws Exception {
        String json = """
        [
          {
            "competitions": [
              {
                "competitors": [
                  { "id": "1", "team": { "displayName": "France" } },
                  { "id": "2", "team": { "displayName": "Argentina" } }
                ],
                "details": [
                  {
                    "scoringPlay": true,
                    "ownGoal": false,
                    "team": { "id": "1" },
                    "athletesInvolved": [
                      { "id": "10", "displayName": "Kylian Mbappé", "shortName": "K. Mbappé", "position": "FW" }
                    ]
                  },
                  {
                    "scoringPlay": true,
                    "ownGoal": false,
                    "team": { "id": "1" },
                    "athletesInvolved": [
                      { "id": "10", "displayName": "Kylian Mbappé", "shortName": "K. Mbappé", "position": "FW" }
                    ]
                  },
                  {
                    "scoringPlay": true,
                    "ownGoal": false,
                    "team": { "id": "2" },
                    "athletesInvolved": [
                      { "id": "11", "displayName": "Lionel Messi", "shortName": "L. Messi", "position": "FW" }
                    ]
                  },
                  {
                    "scoringPlay": true,
                    "ownGoal": true,
                    "team": { "id": "2" },
                    "athletesInvolved": [
                      { "id": "12", "displayName": "Defender", "shortName": "Defender", "position": "DF" }
                    ]
                  },
                  {
                    "scoringPlay": false,
                    "ownGoal": false,
                    "athletesInvolved": [
                      { "id": "13", "displayName": "Nobody", "shortName": "Nobody", "position": "MF" }
                    ]
                  }
                ]
              }
            ]
          }
        ]
        """;

        JsonNode events = objectMapper.readTree(json);
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenReturn(events);

        topScorerService.refresh(worldCup);

        List<TopScorerDTO> scorers = topScorerService.getTopScorers(worldCup);
        assertNotNull(scorers);
        assertEquals(2, scorers.size());

        assertEquals("Kylian Mbappé", scorers.get(0).name());
        assertEquals(2, scorers.get(0).goals());
        assertEquals("France", scorers.get(0).team());

        assertEquals("Lionel Messi", scorers.get(1).name());
        assertEquals(1, scorers.get(1).goals());
        assertEquals("Argentina", scorers.get(1).team());

        verify(webSocketService, times(1)).broadcastUpdate("DATA_UPDATED");
    }

    private JsonNode goalBy(String player) throws Exception {
        return objectMapper.readTree("""
                [{"competitions": [{
                  "competitors": [{"id": "1", "team": {"displayName": "France"}}],
                  "details": [{"scoringPlay": true, "ownGoal": false, "team": {"id": "1"},
                               "athletesInvolved": [{"id": "10", "displayName": "%s", "shortName": "%s", "position": "FW"}]}]
                }]}]
                """.formatted(player, player));
    }

    @Test
    @DisplayName("Invalida las puntuaciones de los cuadros solo cuando cambian los goleadores")
    void refresh_invalidatesBracketScoresOnlyWhenScorersChange() throws Exception {
        JsonNode events = goalBy("Kylian Mbappé");
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenReturn(events);

        topScorerService.refresh(worldCup);
        topScorerService.refresh(worldCup);

        verify(scoreInvalidationService, times(1)).invalidateCompetition(2L);
    }

    @Test
    @DisplayName("Conserva los goleadores si ESPN deja de devolverlos")
    void refresh_keepsScorersWhenProviderReturnsNoEvents() throws Exception {
        JsonNode events = goalBy("Kylian Mbappé");
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString()))
                .thenReturn(events)
                .thenReturn(objectMapper.createArrayNode());

        topScorerService.refresh(worldCup);
        topScorerService.refresh(worldCup);

        assertEquals(1, topScorerService.getTopScorers(worldCup).size());
        verify(scoreInvalidationService, times(1)).invalidateCompetition(2L);
    }

    @Test
    @DisplayName("Debe manejar fallos del proveedor sin propagar excepcion")
    void refresh_handlesExceptionGracefully() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenThrow(new RuntimeException("API error"));

        assertDoesNotThrow(() -> topScorerService.refresh(worldCup));
        assertTrue(topScorerService.getTopScorers(worldCup).isEmpty());
        verify(webSocketService, never()).broadcastUpdate(anyString());
    }

    @Test
    @DisplayName("Debe ignorar cuando el proveedor devuelve null")
    void refresh_ignoresNullEvents() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenReturn(null);

        assertDoesNotThrow(() -> topScorerService.refresh(worldCup));
        assertTrue(topScorerService.getTopScorers(worldCup).isEmpty());
        verify(webSocketService, never()).broadcastUpdate(anyString());
    }

    @Test
    @DisplayName("scheduledRefresh debe invocar el refresco de goleadores")
    void scheduledRefresh_callsRefresh() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString())).thenReturn(objectMapper.createArrayNode());

        topScorerService.scheduledRefresh();

        verify(sportsDataProvider, times(1)).fetchScoreboardEvents(eq(Competition.WORLD_CUP_EXTERNAL_ID), anyString());
        // Misma lista que la anterior (vacía): no hay nada que avisar.
        verify(webSocketService, never()).broadcastUpdate(anyString());
    }

    private final Competition laLiga = Competition.builder().id(7L).name("LaLiga").externalId("esp.1")
            .formatType("LEAGUE").season("2026/27").build();

    private SportsDataProvider.ScoringLeaders leadersTable(int season, int mbappe, int lewandowski) throws Exception {
        return new SportsDataProvider.ScoringLeaders(season, objectMapper.readTree("""
                [{"value": %d, "athlete": {"id": "45843", "displayName": "Robert Lewandowski",
                   "shortName": "R. Lewandowski", "team": {"displayName": "Barcelona"}}},
                 {"value": %d, "athlete": {"id": "231388", "displayName": "Kylian Mbappé",
                   "shortName": "K. Mbappé", "team": {"displayName": "Real Madrid"},
                   "position": {"abbreviation": "F"}}},
                 {"value": 0, "athlete": {"id": "1", "displayName": "Sin goles"}}]""".formatted(lewandowski, mbappe)));
    }

    @Test
    @DisplayName("Los goleadores de una liga salen de la tabla del proveedor y solo se recalcula si cambia quién va en cabeza")
    void leagueScorersComeFromTheLeadersTable() throws Exception {
        when(sportsDataProvider.supports("esp.1")).thenReturn(true);
        when(sportsDataProvider.fetchScoringLeaders("esp.1"))
                .thenReturn(leadersTable(2026, 12, 9))
                .thenReturn(leadersTable(2026, 13, 10))
                .thenReturn(leadersTable(2026, 13, 14));

        topScorerService.refresh(laLiga);

        List<TopScorerDTO> scorers = topScorerService.getTopScorers(laLiga);
        assertEquals(List.of("Kylian Mbappé", "Robert Lewandowski"), scorers.stream().map(TopScorerDTO::name).toList());
        assertEquals(12, scorers.get(0).goals());
        assertEquals("231388", scorers.get(0).playerId());
        assertEquals("Real Madrid", scorers.get(0).team());
        verify(topScorerStore).replace(eq(7L), eq(scorers));
        verify(scoreInvalidationService, times(1)).invalidateCompetition(7L);
        verify(sportsDataProvider, never()).fetchScoreboardEvents(anyString(), anyString());

        // Más goles con el mismo líder: se guardan, pero no cambia ningún punto.
        topScorerService.refresh(laLiga);
        assertEquals(13, topScorerService.getTopScorers(laLiga).get(0).goals());
        verify(scoreInvalidationService, times(1)).invalidateCompetition(7L);

        // Cambia el líder: ahora sí.
        topScorerService.refresh(laLiga);
        assertEquals("Robert Lewandowski", topScorerService.getTopScorers(laLiga).get(0).name());
        verify(scoreInvalidationService, times(2)).invalidateCompetition(7L);
        verify(webSocketService, times(2)).notifyResultsChanged(List.of(7L));
        verify(webSocketService, never()).broadcastUpdate(anyString());
    }

    @Test
    @DisplayName("La tabla de otra temporada no vale, ni se pide la de una competición propia, archivada o de otro deporte")
    void aLeadersTableOfAnotherSeasonIsIgnored() throws Exception {
        when(sportsDataProvider.supports(anyString())).thenReturn(true);
        when(sportsDataProvider.fetchScoringLeaders("esp.1")).thenReturn(leadersTable(2027, 3, 1));
        Competition archived = Competition.builder().id(8L).name("LaLiga 25/26").externalId("esp.1")
                .season("2025/26").archivedAt(java.time.Instant.now()).build();
        Competition nba = Competition.builder().id(9L).name("NBA").externalId(Competition.NBA_EXTERNAL_ID).build();

        topScorerService.refresh(laLiga);
        topScorerService.refresh(archived);
        topScorerService.refresh(nba);

        assertTrue(topScorerService.getTopScorers(laLiga).isEmpty());
        verify(sportsDataProvider, times(1)).fetchScoringLeaders(anyString());
        verify(topScorerStore, never()).replace(anyLong(), any());
        verifyNoInteractions(scoreInvalidationService);
    }

    @Test
    @DisplayName("Mientras se juega un partido de una liga con pichichi, su tabla se pide en cada pasada")
    void theLeadersTableIsRefreshedWhileItsCompetitionPlays() throws Exception {
        Competition premier = Competition.builder().id(11L).name("Premier").externalId("eng.1").season("2026/27").build();
        when(editionRepository.findCompetitionsWithPichichi()).thenReturn(List.of(laLiga, premier, worldCup));
        when(sportsDataProvider.supports(anyString())).thenReturn(true);
        when(sportsDataProvider.fetchScoringLeaders("esp.1")).thenReturn(leadersTable(2026, 12, 9));
        when(matchRepository.existsByCompetitionIdAndMatchDateBetween(eq(7L), any(), any())).thenReturn(true);

        topScorerService.refreshWhilePlaying();

        verify(sportsDataProvider).fetchScoringLeaders("esp.1");
        verify(sportsDataProvider, never()).fetchScoringLeaders("eng.1");
        // Los goles de un torneo con grupos llegan con sus partidos.
        verify(matchRepository, never()).existsByCompetitionIdAndMatchDateBetween(eq(2L), any(), any());
        verify(sportsDataProvider, never()).fetchScoreboardEvents(anyString(), anyString());
    }

    @Test
    @DisplayName("La pasada de cada media hora incluye las ligas en las que se juega el pichichi")
    void theScheduledRefreshIncludesLeaguesWithPichichi() throws Exception {
        when(competitionRepository.findByExternalIdIn(any())).thenReturn(List.of());
        when(editionRepository.findCompetitionsWithPichichi()).thenReturn(List.of(laLiga));
        when(sportsDataProvider.supports("esp.1")).thenReturn(true);
        when(sportsDataProvider.fetchScoringLeaders("esp.1")).thenReturn(leadersTable(2026, 12, 9));

        topScorerService.scheduledRefresh();

        assertEquals(2, topScorerService.getTopScorers(laLiga).size());
    }

    @Configuration
    static class TestContextConfig {
        @Bean
        public ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        public WebSocketService webSocketService() {
            return mock(WebSocketService.class);
        }

        @Bean
        public HttpClient httpClient() {
            return mock(HttpClient.class);
        }

        @Bean
        public CircuitBreakerRegistry circuitBreakerRegistry() {
            return CircuitBreakerRegistry.ofDefaults();
        }

        @Bean
        public ScoreInvalidationService scoreInvalidationService() {
            return mock(ScoreInvalidationService.class);
        }

        @Bean
        public KnockoutBracketService knockoutBracketService() {
            return mock(KnockoutBracketService.class);
        }

        @Bean
        public TopScorerStore topScorerStore() {
            return mock(TopScorerStore.class);
        }

        @Bean
        public CompetitionRepository competitionRepository() {
            return mock(CompetitionRepository.class);
        }

        @Bean
        public EditionRepository editionRepository() {
            return mock(EditionRepository.class);
        }

        @Bean
        public MatchRepository matchRepository() {
            return mock(MatchRepository.class);
        }
    }
}
