package com.porra.mundial.service.account;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.RefreshToken;
import com.porra.mundial.model.SessionHandoff;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.RefreshTokenRepository;
import com.porra.mundial.repository.SessionHandoffRepository;
import com.porra.mundial.service.account.SessionHandoffService.Handoff;
import com.porra.mundial.service.account.SessionService.SessionTokens;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Traspaso de sesión de Safari a la app instalada en iPhone, contra Postgres real. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({SessionHandoffService.class, SessionService.class, JwtUtil.class})
class SessionHandoffServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private SessionHandoffService handoffService;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TestEntityManager em;

    @Autowired
    private SessionHandoffRepository handoffRepository;

    @Autowired
    private RefreshTokenRepository tokenRepository;

    private UserAccount user(String email) {
        return em.persist(UserAccount.builder().googleEmail(email).googleName(email).participantName(email).build());
    }

    private SessionHandoff stored(Handoff handoff) {
        return handoffRepository.findByCodeHashForUpdate(SessionService.hash(handoff.code())).orElseThrow();
    }

    private Long familyId(String refreshToken) {
        return tokenRepository.findByTokenHash(SessionService.hash(refreshToken)).map(RefreshToken::getFamilyId).orElseThrow();
    }

    @Test
    void prepareStoresOnlyTheHashOfAShortLivedCode() {
        UserAccount ana = user("ana@test.com");

        Handoff handoff = handoffService.prepare("ana@test.com").orElseThrow();

        assertThat(handoff.code()).matches("[A-Za-z0-9_-]{43}");
        assertThat(handoff.expiresAt()).isCloseTo(Instant.now().plus(Duration.ofMinutes(30)), within(Duration.ofMinutes(1)));
        assertThat(handoffRepository.findByCodeHashForUpdate(handoff.code())).isEmpty();
        assertThat(stored(handoff).getUserId()).isEqualTo(ana.getId());
    }

    @Test
    void redeemOpensANewSessionOfTheAccountThatAskedForIt() {
        UserAccount ana = user("ana@test.com");
        user("luis@test.com");
        SessionTokens safari = sessionService.start(ana);
        Handoff handoff = handoffService.prepare("ana@test.com").orElseThrow();

        SessionTokens app = handoffService.redeem(handoff.code()).orElseThrow();

        assertThat(jwtUtil.verify(app.accessToken()).orElseThrow().userId()).isEqualTo(ana.getId());
        assertThat(app.user().getId()).isEqualTo(ana.getId());
        // Una sesión aparte: rotar la de la app no toca la de Safari, ni al revés.
        assertThat(familyId(app.refreshToken())).isNotEqualTo(familyId(safari.refreshToken()));
        assertThat(sessionService.refresh(app.refreshToken())).isPresent();
        assertThat(sessionService.refresh(safari.refreshToken())).isPresent();
    }

    @Test
    void aCodeOnlyWorksOnce() {
        user("ana@test.com");
        Handoff handoff = handoffService.prepare("ana@test.com").orElseThrow();

        assertThat(handoffService.redeem(handoff.code())).isPresent();
        assertThat(handoffService.redeem(handoff.code())).isEmpty();
    }

    @Test
    void anExpiredCodeIsRejectedAndForgotten() {
        user("ana@test.com");
        Handoff handoff = handoffService.prepare("ana@test.com").orElseThrow();
        SessionHandoff row = stored(handoff);
        row.setExpiresAt(Instant.now().minusSeconds(1));
        handoffRepository.saveAndFlush(row);

        assertThat(handoffService.redeem(handoff.code())).isEmpty();
        assertThat(handoffRepository.findAll()).isEmpty();
    }

    @Test
    void askingAgainReplacesThePreviousCode() {
        user("ana@test.com");
        Handoff first = handoffService.prepare("ana@test.com").orElseThrow();
        Handoff second = handoffService.prepare("ana@test.com").orElseThrow();

        assertThat(handoffService.redeem(first.code())).isEmpty();
        assertThat(handoffService.redeem(second.code())).isPresent();
    }

    @Test
    void unknownCodesAndAccountsGiveNothing() {
        assertThat(handoffService.redeem("desconocido")).isEmpty();
        assertThat(handoffService.redeem("")).isEmpty();
        assertThat(handoffService.redeem(null)).isEmpty();
        assertThat(handoffService.prepare("nadie@test.com")).isEmpty();
        assertThat(handoffService.prepare(null)).isEmpty();
    }

    @Test
    void loggingOutCancelsAPendingHandoff() {
        UserAccount ana = user("ana@test.com");
        SessionTokens safari = sessionService.start(ana);
        Handoff handoff = handoffService.prepare("ana@test.com").orElseThrow();

        sessionService.end(safari.refreshToken());

        assertThat(handoffService.redeem(handoff.code())).isEmpty();
    }

    @Test
    void purgeDeletesExpiredHandoffs() {
        user("ana@test.com");
        user("luis@test.com");
        SessionHandoff expired = stored(handoffService.prepare("ana@test.com").orElseThrow());
        expired.setExpiresAt(Instant.now().minusSeconds(1));
        handoffRepository.saveAndFlush(expired);
        Handoff live = handoffService.prepare("luis@test.com").orElseThrow();

        sessionService.purgeExpiredSessions();
        em.clear();

        assertThat(handoffRepository.findById(expired.getId())).isEmpty();
        assertThat(handoffService.redeem(live.code())).isPresent();
    }
}
