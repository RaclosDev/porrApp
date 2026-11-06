package com.porra.mundial.service;

import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.ScoringStrategy;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * «Mis ligas» pide la clasificación dentro de una transacción de solo lectura. Guardar ahí los puntos recalculados
 * fallaba en Postgres y dejaba la transacción abortada, así que la petición entera acababa en 500.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import(LeaderboardService.class)
class LeaderboardReadOnlyTransactionTest {
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Autowired LeaderboardService leaderboard;
    @Autowired PlatformTransactionManager transactions;
    @Autowired UserAccountRepository users;
    @Autowired LeagueRepository leagues;
    @Autowired CompetitionRepository competitions;
    @Autowired EditionRepository editions;
    @Autowired MatchRepository matches;
    @Autowired PredictionRepository predictions;
    @Autowired MatchPredictionRepository matchPredictions;
    @MockitoBean TopScorerService topScorers;
    @MockitoBean OfficialResultsService officialResults;
    @MockitoBean ScoringStrategy scoringStrategy;
    @MockitoBean CustomBracketScoringService customBracketScoring;

    @Test
    void savesStaleScoresWhenCalledFromAReadOnlyTransaction() {
        UserAccount user = users.save(UserAccount.builder().googleEmail("readonly@test.invalid")
                .googleName("Lectura").participantName("Lectura").build());
        League league = leagues.save(League.builder().name("Solo lectura").joinCode("READONLY1").adminUser(user).build());
        Competition laLiga = competitions.findByExternalId("esp.1").orElseThrow();
        Edition edition = editions.save(Edition.builder().league(league).competition(laLiga)
                .poolFormat(PoolFormat.MATCH_DAY).build());
        Match match = matches.save(Match.builder().competition(laLiga).externalId("readonly-1").round("Jornada 1").build());
        Prediction prediction = predictions.save(Prediction.builder().user(user).edition(edition).name("Lectura").build());
        matchPredictions.save(MatchPrediction.builder().prediction(prediction).match(match)
                .homeScore(1).awayScore(0).predictionSign("1").pointsAwarded(3).build());
        TransactionTemplate readOnly = new TransactionTemplate(transactions);
        readOnly.setReadOnly(true);

        List<Integer> totals = readOnly.execute(status -> {
            List<Integer> rows = leaderboard.getLeaderboard(league.getId()).stream()
                    .map(row -> row.getTotal()).toList();
            // La transacción sigue utilizable después de recalcular: aquí fallaba con «transaction is aborted».
            assertThat(predictions.findByEditionLeagueIdWithUserAndEdition(league.getId())).hasSize(1);
            return rows;
        });

        assertThat(totals).containsExactly(3);
        Prediction saved = predictions.findById(prediction.getId()).orElseThrow();
        assertThat(saved.getScoreCalculatedAt()).isNotNull();
        assertThat(saved.getTotalPoints()).isEqualTo(3);
    }
}
