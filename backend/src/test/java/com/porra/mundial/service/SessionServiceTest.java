package com.porra.mundial.service;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.RefreshToken;
import com.porra.mundial.model.RefreshTokenFamily;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.RefreshTokenFamilyRepository;
import com.porra.mundial.repository.RefreshTokenRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.SessionService.SessionTokens;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
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

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    private UserAccount user(String email) {
        return em.persist(UserAccount.builder().googleEmail(email).googleName(email).participantName(email).build());
    }

    private RefreshTokenFamily familyOf(String refreshToken) {
        RefreshToken token = tokenRepository.findByTokenHash(SessionService.hash(refreshToken)).orElseThrow();
        em.flush();
        em.clear();
        return familyRepository.findById(token.getFamilyId()).orElseThrow();
    }

    private String legacyToken(String email, Instant expiresAt) {
        return Jwts.builder()
                .subject(email)
                .claim("email", email)
                .issuedAt(Date.from(expiresAt.minus(Duration.ofDays(7))))
                .expiration(Date.from(expiresAt))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    @Test
    void startIssuesAnAccessTokenAndStoresOnlyTheRefreshTokenHash() {
        UserAccount ana = user("ana@test.com");

        SessionTokens session = sessionService.start(ana);

        JwtUtil.VerifiedToken access = jwtUtil.verify(session.accessToken()).orElseThrow();
        assertThat(access.userId()).isEqualTo(ana.getId());
        assertThat(access.email()).isEqualTo("ana@test.com");
        assertThat(access.legacy()).isFalse();
        // 32 bytes aleatorios en base64url.
        assertThat(session.refreshToken()).matches("[A-Za-z0-9_-]{43}");
        assertThat(session.refreshExpiresAt()).isCloseTo(Instant.now().plus(Duration.ofDays(30)), within(Duration.ofMinutes(1)));
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
        // Rotar no alarga la sesión.
        assertThat(third.refreshExpiresAt()).isEqualTo(first.refreshExpiresAt());
        assertThat(familyOf(third.refreshToken()).getId()).isEqualTo(familyOf(first.refreshToken()).getId());
        assertThat(tokenRepository.findByTokenHash(SessionService.hash(first.refreshToken())).orElseThrow().getRotatedAt())
                .isNotNull();
    }

    @Test
    void reusingARotatedTokenRevokesTheWholeSession() {
        UserAccount luis = user("luis@test.com");
        SessionTokens stolen = sessionService.start(luis);
        SessionTokens otherDevice = sessionService.start(luis);
        SessionTokens legit = sessionService.refresh(stolen.refreshToken()).orElseThrow();

        assertThat(sessionService.refresh(stolen.refreshToken())).isEmpty();

        assertThat(familyOf(legit.refreshToken()).getRevokedAt()).isNotNull();
        assertThat(sessionService.refresh(legit.refreshToken())).isEmpty();
        // Las sesiones de otros dispositivos siguen.
        assertThat(sessionService.refresh(otherDevice.refreshToken())).isPresent();
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
    void exchangesALegacyTokenForASessionThatEndsWhenTheTokenWould() {
        UserAccount eva = user("eva@test.com");
        Instant legacyExpiry = Instant.now().plus(Duration.ofDays(3));

        SessionTokens session = sessionService.exchangeLegacyToken(legacyToken("eva@test.com", legacyExpiry)).orElseThrow();

        assertThat(jwtUtil.verify(session.accessToken()).orElseThrow().userId()).isEqualTo(eva.getId());
        assertThat(session.refreshExpiresAt()).isCloseTo(legacyExpiry, within(Duration.ofSeconds(1)));
        assertThat(sessionService.refresh(session.refreshToken())).isPresent();
    }

    @Test
    void onlyValidLegacyTokensOfExistingUsersCanBeExchanged() {
        UserAccount pau = user("pau@test.com");

        // Un access token de 15 minutos no puede convertirse en una sesión de 30 días.
        assertThat(sessionService.exchangeLegacyToken(jwtUtil.generateAccessToken(pau.getId(), "pau@test.com"))).isEmpty();
        assertThat(sessionService.exchangeLegacyToken(legacyToken("pau@test.com", Instant.now().minusSeconds(1)))).isEmpty();
        assertThat(sessionService.exchangeLegacyToken(legacyToken("nadie@test.com", Instant.now().plusSeconds(60)))).isEmpty();
        assertThat(sessionService.exchangeLegacyToken("no-es-un-jwt")).isEmpty();
    }

    @Test
    void legacyTokensCannotBeExchangedForAnAccountWithAStableGoogleIdentity() {
        UserAccount currentOwner = user("reassigned@test.com");
        currentOwner.setGoogleSub("google-new-owner");
        em.flush();

        assertThat(sessionService.exchangeLegacyToken(legacyToken("reassigned@test.com",
                Instant.now().plusSeconds(60))).isPresent()).isFalse();
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

    /**
     * Dos refrescos a la vez con el mismo token: la familia bloqueada los pone en fila, así que
     * uno rota y el otro es una reutilización. Nunca salen dos ramas válidas de la sesión.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRefreshesWithTheSameTokenNeverBothSucceed() throws Exception {
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

        assertThat(results).filteredOn(Optional::isPresent).hasSize(1);
        RefreshToken spent = tokenRepository.findByTokenHash(SessionService.hash(session.refreshToken())).orElseThrow();
        assertThat(familyRepository.findById(spent.getFamilyId()).orElseThrow().getRevokedAt()).isNotNull();
    }
}
