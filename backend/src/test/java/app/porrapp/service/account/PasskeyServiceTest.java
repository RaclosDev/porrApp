package app.porrapp.service.account;

import app.porrapp.config.JwtUtil;
import app.porrapp.config.PasskeyConfig;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Passkey;
import app.porrapp.model.PasskeyChallenge;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PasskeyChallengeRepository;
import app.porrapp.repository.PasskeyRepository;
import app.porrapp.service.account.PasskeyService.Ceremony;
import app.porrapp.service.account.PasskeyService.PasskeyView;
import app.porrapp.service.account.SessionService.SessionTokens;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import app.porrapp.SharedPostgres;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Llaves de acceso de principio a fin, con un autenticador de pruebas y Postgres real. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({PasskeyService.class, PasskeyCredentialStore.class, PasskeyConfig.class, SessionService.class, JwtUtil.class})
class PasskeyServiceTest {

    private static final String ORIGIN = "https://porrapp.app";

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = SharedPostgres.rollback();

    @Autowired private PasskeyService passkeys;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private SessionService sessionService;
    @Autowired private PasskeyRepository passkeyRepository;
    @Autowired private PasskeyChallengeRepository challengeRepository;
    @Autowired private TestEntityManager em;

    private UserAccount user(String email) {
        return em.persist(UserAccount.builder().googleEmail(email).googleName(email).participantName("Ana").build());
    }

    private PasskeyView register(String email, FakeAuthenticator device, String name) throws Exception {
        Ceremony ceremony = passkeys.startRegistration(email);
        return passkeys.finishRegistration(email, ceremony.requestId(), device.register(ceremony.browserOptionsJson()), name);
    }

    @Test
    void registersAPasskeyAndSignsInWithIt() throws Exception {
        UserAccount ana = user("ana@example.com");
        FakeAuthenticator iphone = new FakeAuthenticator(ORIGIN, "porrapp.app");

        PasskeyView saved = register("ana@example.com", iphone, "  iPhone de Ana ");

        assertThat(saved.name()).isEqualTo("iPhone de Ana");
        Ceremony login = passkeys.startLogin();
        // Llave descubrible: el servidor no dice qué cuentas hay, el dispositivo las ofrece.
        assertThat(login.browserOptionsJson()).doesNotContain("ana@example.com").doesNotContain("allowCredentials\":[{");

        Optional<SessionTokens> session = passkeys.finishLogin(login.requestId(), iphone.login(login.browserOptionsJson()));

        assertThat(session).isPresent();
        assertThat(session.get().user().getId()).isEqualTo(ana.getId());
        assertThat(jwtUtil.verify(session.get().accessToken())).map(JwtUtil.VerifiedToken::email)
                .contains("ana@example.com");
        Passkey stored = passkeyRepository.findByCredentialId(iphone.credentialId()).orElseThrow();
        assertThat(stored.getSignatureCount()).isEqualTo(1);
        assertThat(stored.getLastUsedAt()).isNotNull();
    }

    @Test
    void theRegistrationOptionsNameTheAccountAndAskForADiscoverableVerifiedKey() {
        user("ana@example.com");

        String options = passkeys.startRegistration("ana@example.com").browserOptionsJson();

        assertThat(options)
                .contains("\"name\":\"ana@example.com\"", "\"displayName\":\"Ana\"", "\"id\":\"porrapp.app\"")
                .contains("\"residentKey\":\"required\"", "\"userVerification\":\"required\"");
    }

    @Test
    void everyPasskeyOfAnAccountSharesItsUserHandle() throws Exception {
        user("ana@example.com");
        register("ana@example.com", new FakeAuthenticator(ORIGIN, "porrapp.app"), "iPhone");
        register("ana@example.com", new FakeAuthenticator(ORIGIN, "porrapp.app"), "Mac");

        var stored = passkeyRepository.findAll();
        assertThat(stored).hasSize(2);
        assertThat(stored.get(0).getUserHandle()).isEqualTo(stored.get(1).getUserHandle());
    }

    @Test
    void aChallengeIsSpentEvenWhenTheAnswerIsWrong() throws Exception {
        user("ana@example.com");
        FakeAuthenticator device = new FakeAuthenticator(ORIGIN, "porrapp.app");
        Ceremony ceremony = passkeys.startRegistration("ana@example.com");

        assertThatThrownBy(() -> passkeys.finishRegistration("ana@example.com", ceremony.requestId(), "{\"nope\":1}", null))
                .isInstanceOf(BusinessException.class);
        // La respuesta buena ya no vale: el reto se gastó.
        String answer = device.register(ceremony.browserOptionsJson());
        assertThatThrownBy(() -> passkeys.finishRegistration("ana@example.com", ceremony.requestId(), answer, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("demasiado tiempo");
        assertThat(passkeyRepository.count()).isZero();
    }

    @Test
    void anotherAccountCannotUseSomeoneElsesRegistration() throws Exception {
        user("ana@example.com");
        user("eva@example.com");
        Ceremony ceremony = passkeys.startRegistration("ana@example.com");
        String answer = new FakeAuthenticator(ORIGIN, "porrapp.app").register(ceremony.browserOptionsJson());

        assertThatThrownBy(() -> passkeys.finishRegistration("eva@example.com", ceremony.requestId(), answer, null))
                .isInstanceOf(BusinessException.class);
        assertThat(passkeyRepository.count()).isZero();
    }

    @Test
    void aKeyFromAnotherSiteIsRejected() throws Exception {
        user("ana@example.com");
        Ceremony ceremony = passkeys.startRegistration("ana@example.com");
        String phished = new FakeAuthenticator("https://porrapp.app.evil.example", "porrapp.app")
                .register(ceremony.browserOptionsJson());

        assertThatThrownBy(() -> passkeys.finishRegistration("ana@example.com", ceremony.requestId(), phished, null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void anExpiredOrReusedLoginChallengeOpensNothing() throws Exception {
        user("ana@example.com");
        FakeAuthenticator device = new FakeAuthenticator(ORIGIN, "porrapp.app");
        register("ana@example.com", device, "iPhone");

        Ceremony login = passkeys.startLogin();
        String answer = device.login(login.browserOptionsJson());
        assertThat(passkeys.finishLogin(login.requestId(), answer)).isPresent();
        assertThat(passkeys.finishLogin(login.requestId(), answer)).isEmpty();

        Ceremony late = passkeys.startLogin();
        PasskeyChallenge challenge = challengeRepository.findById(late.requestId()).orElseThrow();
        challenge.setExpiresAt(Instant.now().minusSeconds(1));
        em.flush();
        assertThat(passkeys.finishLogin(late.requestId(), device.login(late.browserOptionsJson()))).isEmpty();
    }

    @Test
    void aDeletedPasskeyNoLongerSignsIn() throws Exception {
        user("ana@example.com");
        FakeAuthenticator device = new FakeAuthenticator(ORIGIN, "porrapp.app");
        PasskeyView saved = register("ana@example.com", device, "iPhone");

        assertThat(passkeys.delete("ana@example.com", saved.id())).isTrue();

        Ceremony login = passkeys.startLogin();
        assertThat(passkeys.finishLogin(login.requestId(), device.login(login.browserOptionsJson()))).isEmpty();
    }

    @Test
    void onlyTheOwnerListsAndDeletesTheirPasskeys() throws Exception {
        user("ana@example.com");
        user("eva@example.com");
        PasskeyView saved = register("ana@example.com", new FakeAuthenticator(ORIGIN, "porrapp.app"), null);

        assertThat(passkeys.list("eva@example.com")).isEmpty();
        assertThat(passkeys.delete("eva@example.com", saved.id())).isFalse();
        assertThat(passkeys.list("ana@example.com")).extracting(PasskeyView::name).containsExactly("Llave de acceso");
    }

    @Test
    void anAccountHasAtMostTenPasskeys() throws Exception {
        user("ana@example.com");
        for (int i = 0; i < PasskeyService.MAX_PASSKEYS; i++) {
            register("ana@example.com", new FakeAuthenticator(ORIGIN, "porrapp.app"), "Llave " + i);
        }

        assertThatThrownBy(() -> passkeys.startRegistration("ana@example.com"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("10 llaves");
    }

    @Test
    void theNightlyCleanupDropsAbandonedChallenges() {
        Ceremony abandoned = passkeys.startLogin();
        Ceremony fresh = passkeys.startLogin();
        challengeRepository.findById(abandoned.requestId()).orElseThrow().setExpiresAt(Instant.now().minusSeconds(1));
        em.flush();

        sessionService.purgeExpiredSessions();
        em.clear();

        assertThat(challengeRepository.findById(abandoned.requestId())).isEmpty();
        assertThat(challengeRepository.findById(fresh.requestId())).isPresent();
    }

    @Test
    void namesAreTrimmedAndCapped() {
        assertThat(PasskeyService.cleanName(null)).isEqualTo("Llave de acceso");
        assertThat(PasskeyService.cleanName(" Mac\u0007 ")).isEqualTo("Mac");
        assertThat(PasskeyService.cleanName("x".repeat(100))).hasSize(PasskeyService.MAX_NAME_LENGTH);
    }
}
