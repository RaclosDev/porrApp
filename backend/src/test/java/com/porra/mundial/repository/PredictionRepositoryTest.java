package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** Consultas de porras contra Postgres real, con el esquema que montan las migraciones. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class PredictionRepositoryTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private TestEntityManager em;

    @Autowired
    private PredictionRepository predictionRepository;

    @Autowired
    private CompetitionRepository competitionRepository;

    @Autowired
    private MatchPredictionRepository matchPredictionRepository;

    private Prediction persistScoredPrediction(String email, Competition competition) {
        UserAccount user = em.persist(UserAccount.builder().googleEmail(email).googleName(email)
                .participantName(email).build());
        League league = em.persist(League.builder().name("Liga " + email).joinCode(email.substring(0, 6).toUpperCase())
                .adminUser(user).build());
        Edition edition = em.persist(Edition.builder().league(league).competition(competition)
                .poolFormat(PoolFormat.FULL_BRACKET).build());
        return em.persist(Prediction.builder().user(user).edition(edition).name("Porra")
                .totalPoints(42).scoreCalculatedAt(LocalDateTime.now()).build());
    }

    @Test
    void clearsTheStoredScoresOfOneEditionOnly() {
        Competition worldCup = competitionRepository.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
        Prediction changedRules = persistScoredPrediction("reglas@test.com", worldCup);
        Prediction otherLeague = persistScoredPrediction("otra01@test.com", worldCup);

        int cleared = predictionRepository.clearCalculatedScoresByEditionId(changedRules.getEdition().getId());
        em.clear();

        assertThat(cleared).isEqualTo(1);
        assertThat(predictionRepository.findById(changedRules.getId()).orElseThrow().getScoreCalculatedAt()).isNull();
        assertThat(predictionRepository.findById(otherLeague.getId()).orElseThrow().getScoreCalculatedAt()).isNotNull();
    }

    @Test
    void findsTheMatchPredictionsOfOneEdition() {
        Competition laLiga = competitionRepository.findByExternalId("esp.1").orElseThrow();
        Prediction league = persistScoredPrediction("jornada@test.com", laLiga);
        Prediction otherLeague = persistScoredPrediction("vecina@test.com", laLiga);
        Match match = em.persist(Match.builder().competition(laLiga).externalId("test-reglas-1")
                .matchDate(LocalDateTime.now()).finished(true).homeScore(1).awayScore(0).build());
        MatchPrediction mine = em.persist(MatchPrediction.builder().prediction(league).match(match)
                .homeScore(1).awayScore(0).predictionSign("1").build());
        em.persist(MatchPrediction.builder().prediction(otherLeague).match(match).predictionSign("2").build());
        em.flush();
        em.clear();

        var found = matchPredictionRepository.findWithMatchByPredictionEditionId(league.getEdition().getId());

        assertThat(found).extracting(MatchPrediction::getId).containsExactly(mine.getId());
        assertThat(found.get(0).getMatch().getHomeScore()).isEqualTo(1);
    }

    @Test
    void clearsTheStoredScoresOfOneCompetitionOnly() {
        Competition worldCup = competitionRepository.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
        Competition laLiga = competitionRepository.findByExternalId("esp.1").orElseThrow();
        Prediction bracket = persistScoredPrediction("mundial@test.com", worldCup);
        Prediction matchday = persistScoredPrediction("laliga1@test.com", laLiga);

        int cleared = predictionRepository.clearCalculatedScoresByCompetitionId(worldCup.getId());
        em.clear();

        assertThat(cleared).isEqualTo(1);
        assertThat(predictionRepository.findById(bracket.getId()).orElseThrow().getScoreCalculatedAt()).isNull();
        assertThat(predictionRepository.findById(matchday.getId()).orElseThrow().getScoreCalculatedAt()).isNotNull();
        assertThat(competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)).contains(worldCup.getId());
    }
}
