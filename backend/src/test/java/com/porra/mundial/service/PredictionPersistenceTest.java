package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PredictionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({PredictionService.class, BracketPredictionValidator.class})
class PredictionPersistenceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private TestEntityManager em;
    @Autowired private PredictionService predictions;
    @Autowired private PredictionRepository repository;

    @Test
    void savingAgainUpdatesTheExistingPredictionAndPreservesItsPaymentRecord() {
        UserAccount owner = em.persist(UserAccount.builder().googleEmail("prediction@test.invalid")
                .googleName("Ana").participantName("Ana").build());
        Competition competition = em.getEntityManager().createQuery(
                "select c from Competition c where c.externalId = :id", Competition.class)
                .setParameter("id", Competition.WORLD_CUP_EXTERNAL_ID).getSingleResult();
        League league = em.persist(League.builder().name("Test League").joinCode("TESTSAVE")
                .adminUser(owner).build());
        Edition edition = em.persist(Edition.builder().league(league).competition(competition)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build());
        em.persist(Membership.builder().id(new Membership.MembershipId(owner.getId(), league.getId()))
                .user(owner).league(league).paymentStatus("PAID").build());
        em.flush();

        Prediction first = predictions.createPrediction(owner.getGoogleEmail(), "First", new PredictionDataDTO(), league.getId());
        first.setPaymentMarkedBy(owner);
        first.setPaymentAmount(new BigDecimal("10.00"));
        first.setScoreCalculatedAt(LocalDateTime.now());
        em.flush();
        em.refresh(first);
        Long firstId = first.getId();
        LocalDateTime createdAt = first.getCreatedAt();
        em.clear();

        PredictionDataDTO changed = new PredictionDataDTO();
        changed.setScorer("España");
        Prediction saved = predictions.createPrediction(owner.getGoogleEmail(), "Updated", changed, league.getId());
        em.flush();
        em.clear();

        Prediction reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getId()).isEqualTo(firstId);
        assertThat(reloaded.getCreatedAt()).isEqualTo(createdAt);
        assertThat(reloaded.getName()).isEqualTo("Updated");
        assertThat(reloaded.getBracketData().getScorer()).isEqualTo("España");
        assertThat(reloaded.getPaymentStatus()).isEqualTo("PAID");
        assertThat(reloaded.getPaymentMarkedBy().getId()).isEqualTo(owner.getId());
        assertThat(reloaded.getPaymentAmount()).isEqualByComparingTo("10.00");
        assertThat(reloaded.getScoreCalculatedAt()).isNull();
        assertThat(repository.findByEditionLeagueId(league.getId())).hasSize(1);
    }
}
