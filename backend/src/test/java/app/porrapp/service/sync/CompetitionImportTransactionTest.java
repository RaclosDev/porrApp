package app.porrapp.service.sync;

import app.porrapp.service.tournament.StandingsService;
import app.porrapp.service.tournament.KnockoutBracketService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.service.prediction.MatchPredictionService;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.prediction.CustomLockService;
import app.porrapp.service.notification.WebSocketService;
import app.porrapp.repository.*;
import app.porrapp.model.*;
import app.porrapp.scoring.MatchScoringCalculator;
import app.porrapp.sports.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({CompetitionImportService.class, SyncLock.class, MatchEventProcessor.class, MatchPredictionService.class,
        MatchScoringCalculator.class, StandingsService.class, ScoreInvalidationService.class, CustomLockService.class,
        FightCardService.class, CompetitionSeasonService.class, CompetitionImportTransactionTest.Caches.class})
class CompetitionImportTransactionTest {
    @TestConfiguration @EnableCaching
    static class Caches {
        @Bean CacheManager cacheManager() { return new ConcurrentMapCacheManager("leaderboard", "userGroups", "standings", "officialPoints"); }
    }
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = app.porrapp.SharedPostgres.committing();
    @Autowired CompetitionImportService sync;
    @Autowired TeamRepository teams;
    @Autowired MatchRepository matches;
    @Autowired CompetitionRepository competitions;
    @Autowired UserAccountRepository users;
    @Autowired LeagueRepository leagues;
    @Autowired EditionRepository editions;
    @Autowired PredictionRepository predictions;
    @Autowired MatchPredictionRepository matchPredictions;
    @Autowired CacheManager caches;
    @MockitoSpyBean MatchEventProcessor processor;
    @MockitoBean SportsDataProviderRegistry providers;
    @Autowired StandingsService standings;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean KnockoutBracketService knockout;
    @MockitoBean WebSocketService updates;
    @MockitoBean TopScorerService scorers;
    @MockitoBean app.porrapp.service.prediction.MatchSelectionService matchSelection;
    @MockitoBean LegacyFixtureRepairService repair;
    @MockitoBean app.porrapp.service.tournament.OfficialMatchdayService matchdays;
    @MockitoBean app.porrapp.service.formulaone.FormulaOneSyncService formulaOne;
    private final ObjectMapper json = new ObjectMapper();
    private SportsDataProvider provider;
    private Long competitionId;

    @BeforeEach
    void prepareProvider() throws Exception {
        competitionId = competitions.findByExternalId("esp.1").orElseThrow().getId();
        provider = mock(SportsDataProvider.class);
        when(providers.findProviderForCompetition(anyString())).thenReturn(java.util.Optional.of(provider));
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchTeams("esp.1")).thenReturn(json.readTree("""
                [{"team":{"id":"991001","displayName":"Import Home"}},
                 {"team":{"id":"991002","displayName":"Import Away"}}]
                """));
        caches.getCache("leaderboard").put("before-import", "existing ranking");
    }

    @org.junit.jupiter.api.AfterEach
    void removeImportedTestRows() {
        matches.findByExternalId("990001").ifPresent(match -> {
            matchPredictions.deleteAll(matchPredictions.findByMatchId(match.getId()));
            matches.delete(match);
        });
        for (String id : java.util.List.of("soccer-991001", "soccer-991002", "991001", "991002")) {
            teams.findByExternalId(id).ifPresent(teams::delete);
        }
        processor.teamCache().clear();
        caches.getCache("leaderboard").clear();
    }

    private Competition worldCup() {
        return competitions.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
    }

    private JsonNode events() throws Exception {
        return json.readTree("""
                [{"id":"990001","date":"%s","competitions":[{
                  "status":{"type":{"state":"post","completed":true}},
                  "competitors":[
                    {"homeAway":"home","score":"2","team":{"id":"991001","displayName":"Import Home"}},
                    {"homeAway":"away","score":"1","team":{"id":"991002","displayName":"Import Away"}}]}]},
                 {"id":"990002","date":"%s","competitions":[]}]
                """.formatted(OffsetDateTime.now(), OffsetDateTime.now()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void standingsCachesSurviveRollback(boolean preloadedMatches) {
        for (String name : List.of("standings", "officialPoints", "leaderboard")) {
            caches.getCache(name).put("transaction-check", "previous value");
        }

        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            if (preloadedMatches) {
                standings.recalculate(worldCup(), List.of());
            } else {
                standings.recalculate(worldCup());
            }
            status.setRollbackOnly();
        });

        for (String name : List.of("standings", "officialPoints", "leaderboard")) {
            assertThat(caches.getCache(name).get("transaction-check", String.class))
                    .as(name).isEqualTo("previous value");
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void standingsCachesAreEvictedOnlyAfterCommit(boolean preloadedMatches) {
        for (String name : List.of("standings", "officialPoints", "leaderboard")) {
            caches.getCache(name).put("transaction-check", "previous value");
        }

        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            if (preloadedMatches) {
                standings.recalculate(worldCup(), List.of());
            } else {
                standings.recalculate(worldCup());
            }
            for (String name : List.of("standings", "officialPoints", "leaderboard")) {
                assertThat(caches.getCache(name).get("transaction-check", String.class))
                        .as(name + " before commit").isEqualTo("previous value");
            }
        });

        for (String name : List.of("standings", "officialPoints", "leaderboard")) {
            assertThat(caches.getCache(name).get("transaction-check")).as(name).isNull();
        }
    }

    @Test
    void rollbackRestoresPreviouslyCalculatedPredictionPoints() throws Exception {
        Team home = teams.save(Team.builder().name("Import Home").externalId("991001").build());
        Team away = teams.save(Team.builder().name("Import Away").externalId("991002").build());
        Competition competition = competitions.findById(competitionId).orElseThrow();
        Match original = matches.save(Match.builder().externalId("990001").competition(competition)
                .homeTeam(home).awayTeam(away).homeScore(0).awayScore(0).finished(true)
                .matchDate(java.time.Instant.now()).build());
        UserAccount user = users.save(UserAccount.builder().googleEmail("import-score@test.invalid")
                .googleName("Import Score").participantName("Import Score").build());
        League league = leagues.save(League.builder().name("Import Score").joinCode("IMPSCORE").adminUser(user).build());
        Edition edition = editions.save(Edition.builder().league(league).competition(competition).poolFormat(PoolFormat.MATCH_DAY).build());
        Prediction prediction = predictions.save(Prediction.builder().name("Import Score").user(user).edition(edition)
                .scoreCalculatedAt(java.time.Instant.now()).build());
        MatchPrediction selection = matchPredictions.save(MatchPrediction.builder().prediction(prediction).match(original)
                .homeScore(2).awayScore(1).pointsAwarded(0).build());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(events());
        doAnswer(invocation -> {
            assertThat(matchPredictions.findById(selection.getId()).orElseThrow().getPointsAwarded()).isEqualTo(3);
            throw new IllegalStateException("Rollback after evaluating the first match");
        }).when(processor).process(argThat(event -> event != null && "990002".equals(event.path("id").asText())), any(), any());

        assertThatThrownBy(() -> sync.importCompetitionData(competitionId)).isInstanceOf(IllegalStateException.class);

        assertThat(matchPredictions.findById(selection.getId()).orElseThrow().getPointsAwarded()).isZero();
        assertThat(matches.findById(original.getId()).orElseThrow().getHomeScore()).isZero();
        assertThat(predictions.findById(prediction.getId()).orElseThrow().getScoreCalculatedAt()).isNotNull();
        assertThat(caches.getCache("leaderboard").get("before-import").get()).isEqualTo("existing ranking");
        verifyNoInteractions(updates);

        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(json.createArrayNode().add(events().get(0)));
        sync.importCompetitionData(competitionId);

        assertThat(matchPredictions.findById(selection.getId()).orElseThrow().getPointsAwarded()).isEqualTo(3);
        assertThat(predictions.findById(prediction.getId()).orElseThrow().getScoreCalculatedAt()).isNull();
    }

    @Test
    void httpRunsOutsideTransactionsAndFailureLeavesTheDatabaseUntouched() throws Exception {
        when(provider.fetchTeams("esp.1")).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return json.createArrayNode();
        });
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            throw new java.io.IOException("provider unavailable");
        });

        assertThatThrownBy(() -> sync.importCompetitionData(competitionId)).isInstanceOf(IllegalStateException.class);

        assertThat(teams.findByExternalId("soccer-991001")).isEmpty();
        assertThat(caches.getCache("leaderboard").get("before-import").get()).isEqualTo("existing ranking");
        verifyNoInteractions(updates);
    }

    @Test
    void anImportOfANewerSeasonArchivesTheOldRowAndFillsTheNewOne() throws Exception {
        Instant now = Instant.now();
        Competition old = competitions.save(Competition.builder().name("Liga que cambia").externalId("test.import-season")
                .formatType("LEAGUE").season(String.valueOf(OffsetDateTime.now().getYear() - 2)).build());
        Match played = matches.save(Match.builder().externalId("990900").competition(old)
                .matchDate(now.minus(java.time.Duration.ofDays(300))).finished(true)
                .status(MatchStatusNormalized.FINISHED).build());
        when(provider.fetchSeasonWindow("test.import-season")).thenReturn(new SportsDataProvider.SeasonWindow(
                now.minus(java.time.Duration.ofDays(10)).toString(), now.plus(java.time.Duration.ofDays(290)).toString()));
        JsonNode catalog = provider.fetchTeams("esp.1");
        when(provider.fetchTeams("test.import-season")).thenReturn(catalog);
        when(provider.fetchScoreboardEvents(anyString(), anyString()))
                .thenReturn(json.createArrayNode().add(events().get(0)));
        Long nextId = null;
        try {
            sync.importCompetitionData(old.getId());

            Competition next = competitions.findByExternalId("test.import-season").orElseThrow();
            nextId = next.getId();
            assertThat(nextId).isNotEqualTo(old.getId());
            assertThat(next.getSeason()).isNotNull().isNotEqualTo(old.getSeason());
            assertThat(competitions.findById(old.getId()).orElseThrow().isArchived()).isTrue();
            assertThat(matches.findByCompetitionId(old.getId())).extracting(Match::getId).containsExactly(played.getId());
            assertThat(matches.findByCompetitionId(nextId)).extracting(Match::getExternalId).containsExactly("990001");
            verify(matchdays).numberMatchdays(argThat(row -> row.getId().equals(next.getId())));

            // La siguiente importación ya va a la fila nueva y no vuelve a cambiar nada.
            sync.importCompetitionData(nextId);
            assertThat(competitions.findByExternalId("test.import-season")).map(Competition::getId).contains(nextId);
            assertThat(matches.findByCompetitionId(nextId)).hasSize(1);
        } finally {
            removeImportedTestRows();
            matches.deleteById(played.getId());
            if (nextId != null) competitions.deleteById(nextId);
            competitions.deleteById(old.getId());
        }
    }

    @Test
    void processingFailureRollsBackDataCacheAndNotificationsAndCanBeRetried() throws Exception {
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(events());
        Map<String, app.porrapp.model.Team> before = processor.teamCache();
        doThrow(new IllegalStateException("second event failed")).when(processor)
                .process(argThat(event -> event != null && "990002".equals(event.path("id").asText())), any(), any());

        assertThatThrownBy(() -> sync.importCompetitionData(competitionId)).isInstanceOf(IllegalStateException.class);

        assertThat(teams.findByExternalId("soccer-991001")).isEmpty();
        assertThat(matches.findByExternalId("990001")).isEmpty();
        assertThat(before).doesNotContainKey("soccer-991001");
        assertThat(caches.getCache("leaderboard").get("before-import").get()).isEqualTo("existing ranking");
        verifyNoInteractions(updates);

        when(provider.fetchScoreboardEvents(anyString(), anyString()))
                .thenReturn(json.createArrayNode().add(events().get(0)));
        sync.importCompetitionData(competitionId);

        assertThat(teams.findByExternalId("soccer-991001")).isPresent();
        assertThat(matches.findByExternalId("990001")).isPresent();
        assertThat(caches.getCache("leaderboard").get("before-import")).isNull();
        verify(updates).broadcastMatchScore(any(), eq("Import Home"), eq("Import Away"), eq(2), eq(1), eq("FINISHED"));
    }
}
