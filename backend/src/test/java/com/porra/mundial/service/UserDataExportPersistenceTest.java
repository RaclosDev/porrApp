package com.porra.mundial.service;

import com.porra.mundial.dto.UserDataExport;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.UserAccount;
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

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(UserDataExportService.class)
class UserDataExportPersistenceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private TestEntityManager em;
    @Autowired private UserDataExportService exports;

    @Test
    void exportContainsOnlyTheUsersOwnDataAndNoPushKeys() {
        UserAccount ana = em.persist(UserAccount.builder().googleEmail("export-ana@test.invalid")
                .participantName("Ana").build());
        UserAccount other = em.persist(UserAccount.builder().googleEmail("export-other@test.invalid")
                .participantName("Otro").build());
        Competition competition = em.getEntityManager().createQuery(
                        "select c from Competition c where c.externalId = :id", Competition.class)
                .setParameter("id", Competition.WORLD_CUP_EXTERNAL_ID).getSingleResult();
        League league = em.persist(League.builder().name("Export League").joinCode("TESTEXP1")
                .adminUser(other).build());
        Edition edition = em.persist(Edition.builder().league(league).competition(competition)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build());
        for (UserAccount u : new UserAccount[]{ana, other}) {
            em.persist(Membership.builder().id(new Membership.MembershipId(u.getId(), league.getId()))
                    .user(u).league(league).build());
            em.persist(Prediction.builder().user(u).edition(edition).name(u.getParticipantName())
                    .paymentStatus("PENDING").build());
        }
        em.persist(PushSubscription.builder().user(ana).endpoint("https://push.test/ana")
                .p256dh("secret-key").auth("secret-auth").build());
        em.flush();
        em.clear();

        UserDataExport export = exports.export("export-ana@test.invalid");

        assertThat(export.profile().email()).isEqualTo("export-ana@test.invalid");
        assertThat(export.profile().participantName()).isEqualTo("Ana");
        assertThat(export.leagues()).singleElement()
                .satisfies(l -> assertThat(l.leagueName()).isEqualTo("Export League"));
        assertThat(export.predictions()).singleElement()
                .satisfies(p -> assertThat(p.name()).isEqualTo("Ana"));
        assertThat(export.pushDevices()).hasSize(1);
        assertThat(export.toString()).doesNotContain("Otro", "secret-key", "secret-auth", "push.test");
    }
}
