package app.porrapp.service.prediction;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PredictionRepository;
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
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({PredictionService.class, BracketPredictionValidator.class,
        CustomBracketPredictionValidator.class, CustomLockService.class})
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
        first.setScoreCalculatedAt(Instant.now());
        em.flush();
        em.refresh(first);
        Long firstId = first.getId();
        Instant createdAt = first.getCreatedAt();
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

    @Test
    void bulkDeletesRemoveOnlyThePredictionsOfThatUserAndLeague() {
        Competition competition = em.getEntityManager().createQuery(
                "select c from Competition c where c.externalId = :id", Competition.class)
                .setParameter("id", Competition.WORLD_CUP_EXTERNAL_ID).getSingleResult();
        UserAccount ana = em.persist(UserAccount.builder().googleEmail("ana-bulk@test.invalid")
                .googleName("Ana").participantName("AnaBulk").build());
        UserAccount bea = em.persist(UserAccount.builder().googleEmail("bea-bulk@test.invalid")
                .googleName("Bea").participantName("BeaBulk").build());
        League first = em.persist(League.builder().name("Primera").joinCode("BULKONE234").adminUser(ana).build());
        League second = em.persist(League.builder().name("Segunda").joinCode("BULKTWO234").adminUser(ana).build());
        Edition firstEdition = em.persist(Edition.builder().league(first).competition(competition)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build());
        Edition secondEdition = em.persist(Edition.builder().league(second).competition(competition)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build());
        for (UserAccount user : new UserAccount[] {ana, bea}) {
            for (Edition edition : new Edition[] {firstEdition, secondEdition}) {
                em.persist(Prediction.builder().user(user).edition(edition).name(user.getParticipantName())
                        .paymentStatus("PENDING").createdAt(Instant.now()).build());
            }
        }
        em.flush();

        assertThat(repository.deleteByUserIdAndLeagueId(ana.getId(), first.getId())).isEqualTo(1);
        em.clear();
        assertThat(repository.findByEditionLeagueId(first.getId())).extracting(p -> p.getUser().getId())
                .containsExactly(bea.getId());
        assertThat(repository.findByEditionLeagueId(second.getId())).hasSize(2);
        assertThat(repository.existsByEditionLeagueId(first.getId())).isTrue();

        assertThat(repository.deleteByLeagueId(second.getId())).isEqualTo(2);
        em.clear();
        assertThat(repository.existsByEditionLeagueId(second.getId())).isFalse();
        assertThat(repository.findByEditionLeagueId(first.getId())).hasSize(1);
    }
}
