package com.porra.mundial.service;

import com.porra.mundial.repository.*;
import com.porra.mundial.model.*;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.sports.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
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
import org.testcontainers.junit.jupiter.Container;
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
@Import({SyncService.class, MatchEventProcessor.class, MatchPredictionService.class,
        MatchScoringCalculator.class, StandingsService.class, ScoreInvalidationService.class, CompetitionImportTransactionTest.Caches.class})
class CompetitionImportTransactionTest {
    @TestConfiguration @EnableCaching
    static class Caches {
        @Bean CacheManager cacheManager() { return new ConcurrentMapCacheManager("leaderboard", "userGroups", "standings", "officialPoints"); }
    }
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Autowired SyncService sync;
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
    @MockitoBean LegacyFixtureRepairService repair;
    private final ObjectMapper json = new ObjectMapper();
    private SportsDataProvider provider;
    private Long competitionId;

    @BeforeEach
    void prepareProvider() throws Exception {
        competitionId = competitions.findByExternalId("esp.1").orElseThrow().getId();
        provider = mock(SportsDataProvider.class);
        when(providers.getProviderForCompetition(anyString())).thenReturn(provider);
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
        teams.findByExternalId("991001").ifPresent(teams::delete);
        teams.findByExternalId("991002").ifPresent(teams::delete);
        processor.teamCache().clear();
        caches.getCache("leaderboard").clear();
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
                standings.recalculateStandingsFromMatches(List.of());
            } else {
                standings.recalculateStandingsFromMatches();
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
                standings.recalculateStandingsFromMatches(List.of());
            } else {
                standings.recalculateStandingsFromMatches();
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
                .matchDate(java.time.LocalDateTime.now()).build());
        UserAccount user = users.save(UserAccount.builder().googleEmail("import-score@test.invalid")
                .googleName("Import Score").participantName("Import Score").build());
        League league = leagues.save(League.builder().name("Import Score").joinCode("IMPSCORE").adminUser(user).build());
        Edition edition = editions.save(Edition.builder().league(league).competition(competition).poolFormat(PoolFormat.MATCH_DAY).build());
        Prediction prediction = predictions.save(Prediction.builder().name("Import Score").user(user).edition(edition)
                .scoreCalculatedAt(java.time.LocalDateTime.now()).build());
        MatchPrediction selection = matchPredictions.save(MatchPrediction.builder().prediction(prediction).match(original)
                .homeScore(2).awayScore(1).pointsAwarded(0).build());
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(events());
        doAnswer(invocation -> {
            assertThat(matchPredictions.findById(selection.getId()).orElseThrow().getPointsAwarded()).isEqualTo(5);
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

        assertThat(matchPredictions.findById(selection.getId()).orElseThrow().getPointsAwarded()).isEqualTo(5);
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

        assertThat(teams.findByExternalId("991001")).isEmpty();
        assertThat(caches.getCache("leaderboard").get("before-import").get()).isEqualTo("existing ranking");
        verifyNoInteractions(updates);
    }

    @Test
    void processingFailureRollsBackDataCacheAndNotificationsAndCanBeRetried() throws Exception {
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(events());
        Map<String, com.porra.mundial.model.Team> before = processor.teamCache();
        doThrow(new IllegalStateException("second event failed")).when(processor)
                .process(argThat(event -> event != null && "990002".equals(event.path("id").asText())), any(), any());

        assertThatThrownBy(() -> sync.importCompetitionData(competitionId)).isInstanceOf(IllegalStateException.class);

        assertThat(teams.findByExternalId("991001")).isEmpty();
        assertThat(matches.findByExternalId("990001")).isEmpty();
        assertThat(before).doesNotContainKey("991001");
        assertThat(caches.getCache("leaderboard").get("before-import").get()).isEqualTo("existing ranking");
        verifyNoInteractions(updates);

        when(provider.fetchScoreboardEvents(anyString(), anyString()))
                .thenReturn(json.createArrayNode().add(events().get(0)));
        sync.importCompetitionData(competitionId);

        assertThat(teams.findByExternalId("991001")).isPresent();
        assertThat(matches.findByExternalId("990001")).isPresent();
        assertThat(caches.getCache("leaderboard").get("before-import")).isNull();
        verify(updates).broadcastMatchScore(any(), eq("Import Home"), eq("Import Away"), eq(2), eq(1), eq("FINISHED"));
    }
}
