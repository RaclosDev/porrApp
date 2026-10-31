package com.porra.mundial.service;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.GoogleCredentialVerifier.GoogleIdentity;
import com.porra.mundial.service.SessionService.SessionTokens;
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

/** Inicio de sesión por el sub de Google contra Postgres real (con sus restricciones únicas). */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({AuthService.class, SessionService.class, JwtUtil.class})
class AuthServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private AuthService authService;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TestEntityManager em;

    @MockitoBean
    private GoogleCredentialVerifier googleCredentialVerifier;

    private SessionTokens login(String subject, String email) {
        when(googleCredentialVerifier.verify("credential"))
                .thenReturn(new GoogleIdentity(subject, email, true, "Nombre De Google"));
        SessionTokens session = authService.loginWithGoogle("credential");
        em.flush();
        em.clear();
        return session;
    }

    private UserAccount existing(String subject, String email, String name) {
        return em.persist(UserAccount.builder().googleSub(subject).googleEmail(email).googleName(name)
                .participantName(name).build());
    }

    private UserAccount reload(UserAccount user) {
        return userAccountRepository.findById(user.getId()).orElseThrow();
    }

    @Test
    void aNewGoogleAccountIsRegisteredWithItsSub() {
        SessionTokens session = login("sub-nuevo", "nuevo@test.com");

        UserAccount user = userAccountRepository.findByGoogleSub("sub-nuevo").orElseThrow();
        assertThat(user.getGoogleEmail()).isEqualTo("nuevo@test.com");
        assertThat(user.getParticipantName()).isEqualTo("Nombre De Google");
        assertThat(session.user().getId()).isEqualTo(user.getId());
        assertThat(jwtUtil.verify(session.accessToken()).orElseThrow().userId()).isEqualTo(user.getId());
    }

    @Test
    void anAccountWithoutSubIsLinkedByEmailAndThenFollowsTheSub() {
        UserAccount ana = existing(null, "ana@test.com", "Ana");

        SessionTokens first = login("sub-ana", "ana@test.com");
        assertThat(first.user().getId()).isEqualTo(ana.getId());
        assertThat(reload(ana).getGoogleSub()).isEqualTo("sub-ana");

        // Ana cambia el email de su cuenta de Google: sigue siendo la misma cuenta y se guarda el nuevo.
        SessionTokens second = login("sub-ana", "ana.nueva@test.com");
        assertThat(second.user().getId()).isEqualTo(ana.getId());
        assertThat(reload(ana).getGoogleEmail()).isEqualTo("ana.nueva@test.com");
        assertThat(jwtUtil.verify(second.accessToken()).orElseThrow().email()).isEqualTo("ana.nueva@test.com");
        assertThat(userAccountRepository.findByGoogleEmail("ana@test.com")).isEmpty();
    }

    @Test
    void theSubDecidesTheAccountEvenIfTheEmailBelongsToAnotherUser() {
        UserAccount luis = existing("sub-luis", "luis@test.com", "Luis");
        UserAccount other = existing(null, "compartido@test.com", "Otro");

        SessionTokens session = login("sub-luis", "compartido@test.com");

        assertThat(session.user().getId()).isEqualTo(luis.getId());
        // El email ya es de otro usuario: Luis conserva el suyo y el otro no se toca.
        assertThat(reload(luis).getGoogleEmail()).isEqualTo("luis@test.com");
        assertThat(reload(other).getGoogleSub()).isNull();
    }

    @Test
    void anEmailNowOwnedByAnotherGoogleAccountDoesNotGiveAccessToTheOldAccount() {
        UserAccount eva = existing("sub-eva", "eva@test.com", "Eva");

        assertThatThrownBy(() -> login("sub-intruso", "eva@test.com"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(reload(eva).getGoogleSub()).isEqualTo("sub-eva");
        assertThat(userAccountRepository.findByGoogleSub("sub-intruso")).isEmpty();
    }

    @Test
    void anUnverifiedEmailIsRejected() {
        when(googleCredentialVerifier.verify("credential"))
                .thenReturn(new GoogleIdentity("sub-x", "x@test.com", false, "X"));

        assertThatThrownBy(() -> authService.loginWithGoogle("credential"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        assertThat(userAccountRepository.findByGoogleSub("sub-x")).isEmpty();
    }
}
