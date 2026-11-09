package app.porrapp.service.account;

import app.porrapp.config.JwtUtil;
import app.porrapp.model.RefreshToken;
import app.porrapp.model.RefreshTokenFamily;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.RefreshTokenFamilyRepository;
import app.porrapp.repository.RefreshTokenRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.account.SessionService.SessionTokens;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Emisión, rotación, reutilización, logout y canje de sesiones contra Postgres real. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({SessionService.class, JwtUtil.class})
class SessionServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private SessionService sessionService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TestEntityManager em;

    @Autowired
    private RefreshTokenRepository tokenRepository;

    @Autowired
    private RefreshTokenFamilyRepository familyRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    private UserAccount user(String email) {
        return em.persist(UserAccount.builder().googleEmail(email).googleName(email).participantName(email).build());
    }

    private RefreshTokenFamily familyOf(String refreshToken) {
        RefreshToken token = tokenRepository.findByTokenHash(SessionService.hash(refreshToken)).orElseThrow();
        em.flush();
        em.clear();
        return familyRepository.findById(token.getFamilyId()).orElseThrow();
    }

    /** Lleva la rotación del token al pasado, como si el reintento llegara tarde. */
    private void rotatedAgo(String refreshToken, Duration ago) {
        RefreshToken token = tokenRepository.findByTokenHash(SessionService.hash(refreshToken)).orElseThrow();
        token.setRotatedAt(Instant.now().minus(ago));
        em.flush();
    }

    @Test
    void startIssuesAnAccessTokenAndStoresOnlyTheRefreshTokenHash() {
        UserAccount ana = user("ana@test.com");

        SessionTokens session = sessionService.start(ana);

        JwtUtil.VerifiedToken access = jwtUtil.verify(session.accessToken()).orElseThrow();
        assertThat(access.userId()).isEqualTo(ana.getId());
        assertThat(access.email()).isEqualTo("ana@test.com");
        // 32 bytes aleatorios en base64url.
        assertThat(session.refreshToken()).matches("[A-Za-z0-9_-]{43}");
        assertThat(session.refreshExpiresAt()).isCloseTo(Instant.now().plus(Duration.ofDays(90)), within(Duration.ofMinutes(1)));
        assertThat(tokenRepository.findByTokenHash(session.refreshToken())).isEmpty();
        assertThat(tokenRepository.findByTokenHash(SessionService.hash(session.refreshToken()))).isPresent();
    }

    @Test
    void refreshSpendsTheTokenAndIssuesTheNextOneOfTheSameSession() {
        SessionTokens first = sessionService.start(user("rota@test.com"));

        SessionTokens second = sessionService.refresh(first.refreshToken()).orElseThrow();
        SessionTokens third = sessionService.refresh(second.refreshToken()).orElseThrow();

        assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());
        assertThat(third.refreshToken()).isNotIn(first.refreshToken(), second.refreshToken());
        assertThat(jwtUtil.verify(third.accessToken()).orElseThrow().email()).isEqualTo("rota@test.com");
        assertThat(third.refreshExpiresAt()).isAfterOrEqualTo(first.refreshExpiresAt());
        assertThat(familyOf(third.refreshToken()).getId()).isEqualTo(familyOf(first.refreshToken()).getId());
        assertThat(tokenRepository.findByTokenHash(SessionService.hash(first.refreshToken())).orElseThrow().getRotatedAt())
                .isNotNull();
    }

    @Test
    void usingTheSessionPushesItsExpiryBackUpToTheMaximumLifetime() {
        SessionTokens session = sessionService.start(user("desliza@test.com"));
        RefreshTokenFamily family = familyOf(session.refreshToken());
        family.setExpiresAt(Instant.now().plus(Duration.ofDays(1)));
        familyRepository.saveAndFlush(family);

        SessionTokens used = sessionService.refresh(session.refreshToken()).orElseThrow();

        // Sigue sin caducar mientras se use: 90 días desde el último uso.
        assertThat(used.refreshExpiresAt()).isCloseTo(Instant.now().plus(Duration.ofDays(90)), within(Duration.ofMinutes(1)));
        assertThat(familyOf(used.refreshToken()).getExpiresAt()).isCloseTo(used.refreshExpiresAt(), within(Duration.ofSeconds(1)));

        // Pero no más de un año desde que se inició sesión.
        Instant loggedIn = Instant.now().minus(Duration.ofDays(300));
        RefreshTokenFamily old = familyOf(used.refreshToken());
        old.setCreatedAt(loggedIn);
        familyRepository.saveAndFlush(old);

        SessionTokens capped = sessionService.refresh(used.refreshToken()).orElseThrow();

        assertThat(capped.refreshExpiresAt()).isCloseTo(loggedIn.plus(Duration.ofDays(365)), within(Duration.ofSeconds(1)));
    }

    @Test
    void anExtendedSessionStillRevokesOnReuse() {
        SessionTokens session = sessionService.start(user("reusa@test.com"));
        SessionTokens legit = sessionService.refresh(session.refreshToken()).orElseThrow();
        rotatedAgo(session.refreshToken(), Duration.ofDays(20));

        assertThat(sessionService.refresh(session.refreshToken())).isEmpty();
        assertThat(sessionService.refresh(legit.refreshToken())).isEmpty();
    }

    @Test
    void sessionsRecordTheLastActivityAtMostOnceADay() {
        UserAccount eva = user("eva@test.com");
        Instant longAgo = Instant.now().minus(Duration.ofDays(400));
        eva.setLastActiveAt(longAgo);
        em.flush();

        SessionTokens first = sessionService.start(eva);
        sessionService.refresh(first.refreshToken()).orElseThrow();
        em.flush();
        em.clear();

        Instant recorded = userAccountRepository.findById(eva.getId()).orElseThrow().getLastActiveAt();
        assertThat(recorded).isCloseTo(Instant.now(), within(Duration.ofMinutes(1)));
    }

    @Test
    void reusingARotatedTokenRevokesTheWholeSession() {
        UserAccount luis = user("luis@test.com");
        SessionTokens stolen = sessionService.start(luis);
        SessionTokens otherDevice = sessionService.start(luis);
        SessionTokens legit = sessionService.refresh(stolen.refreshToken()).orElseThrow();
        rotatedAgo(stolen.refreshToken(), SessionService.REUSE_GRACE.plusSeconds(1));

        assertThat(sessionService.refresh(stolen.refreshToken())).isEmpty();

        assertThat(familyOf(legit.refreshToken()).getRevokedAt()).isNotNull();
        assertThat(sessionService.refresh(legit.refreshToken())).isEmpty();
        // Las sesiones de otros dispositivos siguen.
        assertThat(sessionService.refresh(otherDevice.refreshToken())).isPresent();
    }

    @Test
    void aRetryWithinTheGraceWindowKeepsTheSession() {
        UserAccount marta = user("marta@test.com");
        SessionTokens session = sessionService.start(marta);
        SessionTokens lost = sessionService.refresh(session.refreshToken()).orElseThrow();

        // La respuesta anterior no llegó: el navegador reintenta con la cookie antigua.
        SessionTokens retry = sessionService.refresh(session.refreshToken()).orElseThrow();

        assertThat(retry.refreshToken()).isNotEqualTo(lost.refreshToken());
        assertThat(familyOf(retry.refreshToken()).getRevokedAt()).isNull();
        assertThat(sessionService.refresh(retry.refreshToken())).isPresent();
    }

    @Test
    void logoutRevokesTheSession() {
        SessionTokens session = sessionService.start(user("salir@test.com"));

        sessionService.end(session.refreshToken());

        assertThat(familyOf(session.refreshToken()).getRevokedAt()).isNotNull();
        assertThat(sessionService.refresh(session.refreshToken())).isEmpty();
        // Sin cookie o con una desconocida no hay nada que cerrar.
        sessionService.end(null);
        sessionService.end("desconocido");
    }

    @Test
    void anExpiredOrUnknownSessionCannotBeRefreshed() {
        SessionTokens session = sessionService.start(user("caduca@test.com"));
        RefreshTokenFamily family = familyOf(session.refreshToken());
        family.setExpiresAt(Instant.now().minusSeconds(1));
        familyRepository.saveAndFlush(family);

        assertThat(sessionService.refresh(session.refreshToken())).isEmpty();
        assertThat(sessionService.refresh("desconocido")).isEmpty();
        assertThat(sessionService.refresh(null)).isEmpty();
        assertThat(sessionService.refresh("")).isEmpty();
    }

    @Test
    void purgeDeletesExpiredSessionsAndTheirTokens() {
        UserAccount mar = user("mar@test.com");
        SessionTokens expired = sessionService.start(mar);
        SessionTokens active = sessionService.start(mar);
        RefreshTokenFamily family = familyOf(expired.refreshToken());
        family.setExpiresAt(Instant.now().minusSeconds(1));
        familyRepository.saveAndFlush(family);

        sessionService.purgeExpiredSessions();
        em.clear();

        assertThat(familyRepository.findById(family.getId())).isEmpty();
        assertThat(tokenRepository.findByTokenHash(SessionService.hash(expired.refreshToken()))).isEmpty();
        assertThat(tokenRepository.findByTokenHash(SessionService.hash(active.refreshToken()))).isPresent();
    }

    @Test
    void purgeForgetsTokensRotatedLongAgoButKeepsTheSession() {
        SessionTokens first = sessionService.start(user("vieja@test.com"));
        SessionTokens second = sessionService.refresh(first.refreshToken()).orElseThrow();
        SessionTokens current = sessionService.refresh(second.refreshToken()).orElseThrow();
        rotatedAgo(first.refreshToken(), SessionService.REUSE_DETECTION_WINDOW.plusDays(1));

        sessionService.purgeExpiredSessions();
        em.clear();

        assertThat(tokenRepository.findByTokenHash(SessionService.hash(first.refreshToken()))).isEmpty();
        assertThat(tokenRepository.findByTokenHash(SessionService.hash(second.refreshToken()))).isPresent();
        assertThat(sessionService.refresh(current.refreshToken())).isPresent();
    }

    /**
     * Dos refrescos a la vez con el mismo token: la familia bloqueada los pone en fila, así que
     * uno rota y el otro llega dentro del margen de reintento. Los dos reciben un token y la
     * sesión sigue abierta.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRefreshesWithTheSameTokenKeepTheSession() throws Exception {
        UserAccount user = userAccountRepository.save(UserAccount.builder().googleEmail("carrera@test.com")
                .googleName("Carrera").participantName("Carrera").build());
        SessionTokens session = sessionService.start(user);
        CyclicBarrier start = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Optional<SessionTokens>> results;
        try {
            List<CompletableFuture<Optional<SessionTokens>>> attempts = List.of(1, 2).stream()
                    .map(i -> CompletableFuture.supplyAsync(() -> {
                        try {
                            start.await();
                        } catch (Exception e) {
                            throw new IllegalStateException(e);
                        }
                        return sessionService.refresh(session.refreshToken());
                    }, pool))
                    .toList();
            results = attempts.stream().map(CompletableFuture::join).toList();
        } finally {
            pool.shutdown();
        }

        assertThat(results).allMatch(Optional::isPresent);
        RefreshToken spent = tokenRepository.findByTokenHash(SessionService.hash(session.refreshToken())).orElseThrow();
        assertThat(familyRepository.findById(spent.getFamilyId()).orElseThrow().getRevokedAt()).isNull();
    }
}
