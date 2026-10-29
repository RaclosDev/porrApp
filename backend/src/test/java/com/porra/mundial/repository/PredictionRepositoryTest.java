package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
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
