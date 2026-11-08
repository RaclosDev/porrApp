package com.porra.mundial.service.account;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.PasswordResetToken;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PasswordResetTokenRepository;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import com.porra.mundial.service.notification.EmailSender;
import com.porra.mundial.service.notification.EmailSender.Email;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Recuperar la contraseña con el enlace del correo, contra Postgres real. */
@DataJpaTest(properties = {"spring.flyway.out-of-order=true", "app.public-base-url=https://porrapp.app/"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({PasswordResetService.class, PasswordAuthService.class, AccountEmailThrottle.class, SessionService.class,
        JwtUtil.class})
class PasswordResetServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final String LINK_PREFIX = "https://porrapp.app/restablecer-contrasena#token=";

    @Autowired
    private PasswordResetService passwordResetService;

    @Autowired
    private PasswordAuthService passwordAuthService;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private TestEntityManager em;

    @MockitoBean
    private EmailSender emailSender;

    @BeforeEach
    void emailIsConfigured() {
        when(emailSender.enabled()).thenReturn(true);
    }

    private SessionTokens register(String email, String password) {
        // Sin correo, el registro crea la cuenta al momento (sin código).
        when(emailSender.enabled()).thenReturn(false);
        SessionTokens session = passwordAuthService.register(email, password).orElseThrow();
        when(emailSender.enabled()).thenReturn(true);
        em.flush();
        em.clear();
        return session;
    }

    /** Pide el enlace y devuelve el token que viaja en el correo. */
    private String requestLink(String email) {
        passwordResetService.requestReset(email);
        em.flush();
        ArgumentCaptor<Email> sent = ArgumentCaptor.forClass(Email.class);
        verify(emailSender).send(sent.capture());
        String text = sent.getValue().text();
        int start = text.indexOf(LINK_PREFIX) + LINK_PREFIX.length();
        return text.substring(start, text.indexOf('\n', start));
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    @Test
    void theLinkFromTheEmailChangesThePasswordAndClosesOtherSessions() {
        SessionTokens before = register("marta@test.com", "clave-olvidada");

        String token = requestLink(" Marta@Test.com ");
        SessionTokens session = passwordResetService.reset(token, "clave-nueva-larga");
        em.flush();
        em.clear();

        assertThat(session.user().getId()).isEqualTo(before.user().getId());
        assertThat(passwordAuthService.login("marta@test.com", "clave-nueva-larga").user().getId())
                .isEqualTo(before.user().getId());
        assertStatus(() -> passwordAuthService.login("marta@test.com", "clave-olvidada"), HttpStatus.UNAUTHORIZED);
        assertThat(sessionService.refresh(before.refreshToken())).isEmpty();
        assertThat(tokenRepository.count()).isZero();
    }

    @Test
    void theEmailGoesToTheAccountAndOnlyItsHashIsStored() {
        register("pepe@test.com", "clave-de-pepe");

        String token = requestLink("pepe@test.com");

        ArgumentCaptor<Email> sent = ArgumentCaptor.forClass(Email.class);
        verify(emailSender).send(sent.capture());
        assertThat(sent.getValue().to()).isEqualTo("pepe@test.com");
        assertThat(sent.getValue().html()).contains(LINK_PREFIX + token);
        PasswordResetToken stored = tokenRepository.findAll().getFirst();
        assertThat(stored.getTokenHash()).isEqualTo(SessionService.hash(token)).isNotEqualTo(token);
    }

    @Test
    void unknownEmailsGetNoEmailAndGoogleAccountsAreToldToUseGoogle() {
        em.persist(UserAccount.builder().googleSub("sub-g").googleEmail("g@test.com").participantName("G").build());
        em.flush();

        passwordResetService.requestReset("nadie@test.com");
        passwordResetService.requestReset("   ");
        verify(emailSender, never()).send(any());

        passwordResetService.requestReset("g@test.com");
        passwordResetService.requestReset("g@test.com");
        ArgumentCaptor<Email> sent = ArgumentCaptor.forClass(Email.class);
        verify(emailSender, times(1)).send(sent.capture());
        assertThat(sent.getValue().to()).isEqualTo("g@test.com");
        assertThat(sent.getValue().subject()).isEqualTo("Tu cuenta de PorrApp entra con Google");
        assertThat(sent.getValue().text()).doesNotContain("restablecer-contrasena");
        assertThat(tokenRepository.count()).isZero();
    }

    @Test
    void askingAgainWithinAMinuteSendsNothingMore() {
        register("luis@test.com", "clave-de-luis");

        passwordResetService.requestReset("luis@test.com");
        passwordResetService.requestReset("luis@test.com");

        verify(emailSender, times(1)).send(any());
    }

    @Test
    void aLinkWorksOnlyOnce() {
        register("ana@test.com", "clave-de-ana");
        String token = requestLink("ana@test.com");

        passwordResetService.reset(token, "clave-nueva-larga");

        assertStatus(() -> passwordResetService.reset(token, "otra-clave-larga"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordResetService.reset("inventado", "otra-clave-larga"), HttpStatus.BAD_REQUEST);
    }

    @Test
    void anExpiredLinkIsRejected() {
        register("eva@test.com", "clave-de-eva");
        String token = requestLink("eva@test.com");
        PasswordResetToken stored = tokenRepository.findAll().getFirst();
        stored.setExpiresAt(Instant.now().minusSeconds(1));
        em.flush();

        assertStatus(() -> passwordResetService.reset(token, "clave-nueva-larga"), HttpStatus.BAD_REQUEST);
    }

    @Test
    void aShortPasswordDoesNotSpendTheLink() {
        register("leo@test.com", "clave-de-leo");
        String token = requestLink("leo@test.com");

        assertStatus(() -> passwordResetService.reset(token, "corta"), HttpStatus.BAD_REQUEST);

        assertThat(passwordResetService.reset(token, "clave-nueva-larga").user().getGoogleEmail())
                .isEqualTo("leo@test.com");
    }

    @Test
    void withoutAnEmailProviderItIsUnavailable() {
        when(emailSender.enabled()).thenReturn(false);

        assertStatus(() -> passwordResetService.requestReset("marta@test.com"), HttpStatus.SERVICE_UNAVAILABLE);
    }
}
