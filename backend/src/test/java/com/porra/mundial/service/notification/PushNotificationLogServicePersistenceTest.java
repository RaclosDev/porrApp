package com.porra.mundial.service.notification;

import com.porra.mundial.dto.PushNotificationResponse;
import com.porra.mundial.model.PushNotificationLog;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PushNotificationLogRepository;
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

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(PushNotificationLogService.class)
class PushNotificationLogServicePersistenceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private TestEntityManager em;
    @Autowired private PushNotificationLogService service;
    @Autowired private PushNotificationLogRepository repository;

    @Test
    void recentReturnsTheUsersOwnLastThreeNewestFirst() {
        UserAccount ana = em.persist(UserAccount.builder().googleEmail("log-ana@test.invalid").participantName("P").build());
        UserAccount luis = em.persist(UserAccount.builder().googleEmail("log-luis@test.invalid").participantName("P").build());
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        for (int i = 1; i <= 4; i++) {
            service.record(ana.getId(), new PushMessage("Aviso " + i, "Liga " + i, "/jornadas?group=" + i, "t"),
                    now.minus(Duration.ofMinutes(10 - i)));
        }
        service.record(luis.getId(), new PushMessage("De Luis", "Otra liga", null, "t"), now);
        em.flush();
        em.clear();

        assertThat(service.recent("log-ana@test.invalid"))
                .extracting(PushNotificationResponse::title)
                .containsExactly("Aviso 4", "Aviso 3", "Aviso 2");
        assertThat(service.recent("log-luis@test.invalid")).singleElement()
                .satisfies(n -> assertThat(n.url()).isNull());
    }

    @Test
    void cutsLongTextsAndDeletesExpiredEntries() {
        UserAccount ana = em.persist(UserAccount.builder().googleEmail("log-old@test.invalid").participantName("P").build());
        service.record(ana.getId(), new PushMessage("x".repeat(400), "y".repeat(800), "/", "t"), Instant.now());
        em.persist(PushNotificationLog.builder().userId(ana.getId()).title("Viejo").body("b")
                .sentAt(Instant.now().minus(PushNotificationLogService.RETENTION).minus(Duration.ofDays(1))).build());
        em.flush();

        service.deleteExpired();
        em.clear();

        assertThat(repository.findByUserIdOrderBySentAtDesc(ana.getId())).singleElement()
                .satisfies(l -> {
                    assertThat(l.getTitle()).hasSize(255).endsWith("…");
                    assertThat(l.getBody()).hasSize(500);
                });
    }
}
