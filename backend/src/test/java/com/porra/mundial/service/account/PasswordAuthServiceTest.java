package com.porra.mundial.service.account;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.GoogleCredentialVerifier.GoogleIdentity;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/** Registro e inicio de sesión con email y contraseña contra Postgres real. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({PasswordAuthService.class, AuthService.class, SessionService.class, JwtUtil.class})
class PasswordAuthServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private PasswordAuthService passwordAuthService;

    @Autowired
    private AuthService authService;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TestEntityManager em;

    @MockitoBean
    private GoogleCredentialVerifier googleCredentialVerifier;

    @MockitoBean
    private AppleCredentialVerifier appleCredentialVerifier;

    private SessionTokens register(String email, String password) {
        SessionTokens session = passwordAuthService.register(email, password);
        em.flush();
        em.clear();
        return session;
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    @Test
    void registeringCreatesAnAccountWithAHashedPasswordAndOpensASession() {
        SessionTokens session = register("  Marta.Lopez@Test.com ", "una-clave-larga");

        UserAccount marta = userAccountRepository.findByGoogleEmail("marta.lopez@test.com").orElseThrow();
        assertThat(marta.getGoogleSub()).isNull();
        assertThat(marta.getPasswordHash()).startsWith("$2").doesNotContain("una-clave-larga");
        assertThat(marta.getParticipantName()).isEqualTo("marta.lopez");
        assertThat(marta.isProfileSetupCompleted()).isFalse();
        assertThat(jwtUtil.verify(session.accessToken()).orElseThrow().userId()).isEqualTo(marta.getId());
    }

    @Test
    void theRightPasswordOpensASessionAndAWrongOneDoesNot() {
        SessionTokens registered = register("pepe@test.com", "clave-de-pepe");

        SessionTokens session = passwordAuthService.login("PEPE@test.com ", "clave-de-pepe");
        assertThat(session.user().getId()).isEqualTo(registered.user().getId());

        assertStatus(() -> passwordAuthService.login("pepe@test.com", "otra-clave"), HttpStatus.UNAUTHORIZED);
        assertStatus(() -> passwordAuthService.login("nadie@test.com", "clave-de-pepe"), HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aGoogleAccountCannotBeEnteredOrRegisteredAgainWithAPassword() {
        em.persist(UserAccount.builder().googleSub("sub-g").googleEmail("g@test.com").participantName("G").build());
        em.flush();

        assertStatus(() -> passwordAuthService.login("g@test.com", "cualquier-clave"), HttpStatus.UNAUTHORIZED);
        assertStatus(() -> passwordAuthService.register("G@test.com", "cualquier-clave"), HttpStatus.CONFLICT);
    }

    @Test
    void anEmailCanOnlyBeRegisteredOnce() {
        register("repe@test.com", "primera-clave");

        assertStatus(() -> passwordAuthService.register("repe@test.com", "segunda-clave"), HttpStatus.CONFLICT);
    }

    @Test
    void invalidEmailsAndShortOrOverlongPasswordsAreRejected() {
        assertStatus(() -> passwordAuthService.register("sin-arroba", "clave-valida"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordAuthService.register("admin@local", "clave-valida"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordAuthService.register("corta@test.com", "1234567"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordAuthService.register("larga@test.com", "ñ".repeat(37)), HttpStatus.BAD_REQUEST);
        assertThat(userAccountRepository.existsByGoogleEmailIgnoreCase("corta@test.com")).isFalse();
    }

    @Test
    void theNicknameIsMadeUniqueWithASuffix() {
        em.persist(UserAccount.builder().googleEmail("luis@otro.com").participantName("luis").build());
        em.flush();

        assertThat(register("luis@test.com", "clave-de-luis").user().getParticipantName()).isEqualTo("luis1");
    }

    @Test
    void signingInWithGoogleClaimsAPasswordAccountAndClosesItsSessions() {
        // Alguien registra con contraseña un email que no es suyo...
        SessionTokens squatter = register("victima@gmail.com", "clave-del-intruso");

        // ...y la dueña del email entra con Google.
        when(googleCredentialVerifier.verify("credential"))
                .thenReturn(new GoogleIdentity("sub-victima", "victima@gmail.com", true, "Víctima"));
        SessionTokens owner = authService.loginWithGoogle("credential");
        em.flush();
        em.clear();

        assertThat(owner.user().getId()).isEqualTo(squatter.user().getId());
        UserAccount account = userAccountRepository.findById(owner.user().getId()).orElseThrow();
        assertThat(account.getGoogleSub()).isEqualTo("sub-victima");
        assertThat(account.getPasswordHash()).isNull();
        assertThat(sessionService.refresh(squatter.refreshToken())).isEmpty();
        assertThat(sessionService.refresh(owner.refreshToken())).isPresent();
        assertStatus(() -> passwordAuthService.login("victima@gmail.com", "clave-del-intruso"), HttpStatus.UNAUTHORIZED);
    }

    @Test
    void signingInWithAppleAlsoClaimsAPasswordAccount() {
        SessionTokens squatter = register("victima@icloud.com", "clave-del-intruso");

        when(appleCredentialVerifier.verify("apple-token"))
                .thenReturn(new AppleCredentialVerifier.AppleIdentity("apple-victima", "victima@icloud.com", true));
        SessionTokens owner = authService.loginWithApple("apple-token", null);
        em.flush();
        em.clear();

        UserAccount account = userAccountRepository.findById(owner.user().getId()).orElseThrow();
        assertThat(account.getId()).isEqualTo(squatter.user().getId());
        assertThat(account.getAppleSub()).isEqualTo("apple-victima");
        assertThat(account.getPasswordHash()).isNull();
        assertThat(sessionService.refresh(squatter.refreshToken())).isEmpty();
    }
}
