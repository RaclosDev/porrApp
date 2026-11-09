package app.porrapp.service.account;

import app.porrapp.config.JwtUtil;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.account.GoogleCredentialVerifier.GoogleIdentity;
import app.porrapp.service.account.SessionService.SessionTokens;
import app.porrapp.repository.PendingRegistrationRepository;
import app.porrapp.service.notification.EmailSender;
import app.porrapp.service.notification.EmailSender.Email;
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

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Registro e inicio de sesión con email y contraseña contra Postgres real. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({PasswordAuthService.class, AuthService.class, AccountEmailThrottle.class, SessionService.class, JwtUtil.class})
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

    /** Sin configurar (enabled() = false) salvo en las pruebas del código: el registro es inmediato. */
    @MockitoBean
    private EmailSender emailSender;

    @Autowired
    private PendingRegistrationRepository pendingRegistrationRepository;

    private SessionTokens register(String email, String password) {
        SessionTokens session = passwordAuthService.register(email, password).orElseThrow();
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

    /** Registra con el correo configurado y devuelve el código que llega en él. */
    private String codeSentTo(String email, String password) {
        reset(emailSender);
        when(emailSender.enabled()).thenReturn(true);
        assertThat(passwordAuthService.register(email, password)).isEmpty();
        ArgumentCaptor<Email> sent = ArgumentCaptor.forClass(Email.class);
        verify(emailSender).send(sent.capture());
        assertThat(sent.getValue().to()).isEqualTo(email.trim().toLowerCase());
        Matcher code = Pattern.compile("\\b(\\d{6})\\b").matcher(sent.getValue().text());
        assertThat(code.find()).isTrue();
        // El asunto acaba en los logs si el envío falla: el código no va en él.
        assertThat(sent.getValue().subject()).doesNotContain(code.group(1));
        em.flush();
        em.clear();
        return code.group(1);
    }

    private static String otherCode(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }

    @Test
    void withEmailTheAccountIsOnlyCreatedWithTheCodeAndTheSamePassword() {
        String code = codeSentTo(" Nuria@Test.com", "clave-de-nuria");
        assertThat(userAccountRepository.existsByGoogleEmailIgnoreCase("nuria@test.com")).isFalse();
        assertThat(pendingRegistrationRepository.findAll().getFirst().getCodeHash()).doesNotContain(code);

        assertStatus(() -> passwordAuthService.confirmRegistration("nuria@test.com", otherCode(code), "clave-de-nuria"),
                HttpStatus.BAD_REQUEST);
        // Quien pidiera otro código con el mismo email no puede colar su contraseña.
        assertStatus(() -> passwordAuthService.confirmRegistration("nuria@test.com", code, "clave-del-otro"),
                HttpStatus.BAD_REQUEST);
        em.flush();
        em.clear();

        SessionTokens session = passwordAuthService.confirmRegistration("NURIA@test.com ",
                code.substring(0, 3) + " " + code.substring(3), "clave-de-nuria");
        em.flush();
        em.clear();

        UserAccount nuria = userAccountRepository.findByGoogleEmail("nuria@test.com").orElseThrow();
        assertThat(session.user().getId()).isEqualTo(nuria.getId());
        assertThat(nuria.getParticipantName()).isEqualTo("nuria");
        assertThat(pendingRegistrationRepository.count()).isZero();
        assertThat(passwordAuthService.login("nuria@test.com", "clave-de-nuria").user().getId()).isEqualTo(nuria.getId());
    }

    @Test
    void aCodeStopsWorkingAfterTooManyWrongTries() {
        String code = codeSentTo("tere@test.com", "clave-de-tere");
        for (int i = 0; i < PasswordAuthService.MAX_CODE_ATTEMPTS; i++) {
            assertStatus(() -> passwordAuthService.confirmRegistration("tere@test.com", otherCode(code), "clave-de-tere"),
                    HttpStatus.BAD_REQUEST);
            em.flush();
            em.clear();
        }
        assertThat(pendingRegistrationRepository.count()).isZero();
        assertStatus(() -> passwordAuthService.confirmRegistration("tere@test.com", code, "clave-de-tere"),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void registeringAnEmailWithAnAccountAnswersTheSameAndWarnsByEmail() {
        em.persist(UserAccount.builder().googleSub("sub-r").googleEmail("rosa@test.com").participantName("Rosa").build());
        em.flush();
        when(emailSender.enabled()).thenReturn(true);

        assertThat(passwordAuthService.register("Rosa@test.com", "clave-de-rosa")).isEmpty();

        ArgumentCaptor<Email> sent = ArgumentCaptor.forClass(Email.class);
        verify(emailSender).send(sent.capture());
        assertThat(sent.getValue().subject()).isEqualTo("Ya tienes cuenta en PorrApp");
        assertThat(sent.getValue().text()).contains("Continuar con Google").doesNotContainPattern("\\b\\d{6}\\b");
        assertThat(pendingRegistrationRepository.count()).isZero();
    }

    @Test
    void onlyOneEmailPerMinuteGoesToTheSameAddress() {
        codeSentTo("iker@test.com", "clave-de-iker");

        assertStatus(() -> passwordAuthService.register("iker@test.com", "clave-de-iker"), HttpStatus.TOO_MANY_REQUESTS);
        verify(emailSender, times(1)).send(any());
    }

    @Test
    void commonPasswordsAndTheEmailItselfAreRejected() {
        assertStatus(() -> passwordAuthService.register("comun@test.com", "Password123"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordAuthService.register("comun@test.com", "realmadrid"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordAuthService.register("comun@test.com", "aaaaaaaaaa"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> passwordAuthService.register("alejandro.gil@test.com", "Alejandro.Gil"), HttpStatus.BAD_REQUEST);
        verify(emailSender, never()).send(any());
        assertThat(userAccountRepository.existsByGoogleEmailIgnoreCase("comun@test.com")).isFalse();
    }

    @Test
    void tooManyWrongPasswordsLockTheEmailForAWhile() {
        register("bloq@test.com", "clave-de-bloq");
        for (int i = 0; i < PasswordAuthService.MAX_FAILED_LOGINS; i++) {
            assertStatus(() -> passwordAuthService.login("bloq@test.com", "otra-clave"), HttpStatus.UNAUTHORIZED);
        }

        assertStatus(() -> passwordAuthService.login("BLOQ@test.com", "clave-de-bloq"), HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void aGoogleAccountGetsTheSameMessageAsAWrongPassword() {
        em.persist(UserAccount.builder().googleSub("sub-m").googleEmail("m@test.com").participantName("M").build());
        em.flush();

        assertThatThrownBy(() -> passwordAuthService.login("m@test.com", "cualquier-clave"))
                .hasMessageContaining(PasswordAuthService.WRONG_CREDENTIALS);
        assertThatThrownBy(() -> passwordAuthService.login("nadie@test.com", "cualquier-clave"))
                .hasMessageContaining(PasswordAuthService.WRONG_CREDENTIALS);
    }
}
