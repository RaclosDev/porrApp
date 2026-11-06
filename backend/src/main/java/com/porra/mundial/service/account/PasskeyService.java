package com.porra.mundial.service.account;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Passkey;
import com.porra.mundial.model.PasskeyChallenge;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PasskeyChallengeRepository;
import com.porra.mundial.repository.PasskeyRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import com.yubico.webauthn.exception.AssertionFailedException;
import com.yubico.webauthn.exception.RegistrationFailedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Llaves de acceso (WebAuthn): entrar con Face ID, huella o el PIN del dispositivo sin pasar por
 * Google. Sobre todo para la app instalada en iPhone, que no comparte la sesión de Google de Safari.
 * <ul>
 *   <li>Se añaden con la sesión ya iniciada (con Google), desde el perfil.</li>
 *   <li>Son llaves «descubribles»: para entrar no hace falta escribir el email, el dispositivo
 *       ofrece las cuentas que tiene guardadas.</li>
 *   <li>Siempre se pide verificar a la persona (Face ID, huella o PIN), no solo tener el dispositivo.</li>
 *   <li>Cada reto vive {@link #CHALLENGE_TTL} y se gasta al comprobarlo, salga bien o mal. Los que
 *       nadie completa los borra la limpieza nocturna de {@link SessionService}.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasskeyService {

    static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    static final int MAX_PASSKEYS = 10;
    static final int MAX_NAME_LENGTH = 60;

    private static final int RANDOM_ID_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RelyingParty relyingParty;
    private final PasskeyRepository passkeyRepository;
    private final PasskeyChallengeRepository challengeRepository;
    private final UserAccountRepository userAccountRepository;
    private final SessionService sessionService;

    /** Opciones para que el navegador cree una llave de la cuenta del email. */
    @Transactional
    public Ceremony startRegistration(String email) {
        UserAccount user = requireUser(email);
        ensureRoomForAnother(user);
        ByteArray userHandle = passkeyRepository.findFirstByUserId(user.getId())
                .map(passkey -> new ByteArray(passkey.getUserHandle()))
                .orElseGet(() -> new ByteArray(randomBytes()));
        PublicKeyCredentialCreationOptions options = relyingParty.startRegistration(StartRegistrationOptions.builder()
                .user(UserIdentity.builder()
                        .name(user.getGoogleEmail())
                        .displayName(displayName(user))
                        .id(userHandle)
                        .build())
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                        .residentKey(ResidentKeyRequirement.REQUIRED)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build())
                .timeout(CHALLENGE_TTL.toMillis())
                .build());
        try {
            return newCeremony(user.getId(), options.toJson(), options.toCredentialsCreateJson());
        } catch (IOException e) {
            throw new IllegalStateException("No se han podido serializar las opciones de registro", e);
        }
    }

    /**
     * Comprueba la llave creada por el navegador y la guarda. El reto se gasta aunque falle.
     *
     * @throws BusinessException 400 si el reto no vale o la respuesta no es correcta
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public PasskeyView finishRegistration(String email, String requestId, String credentialJson, String name) {
        UserAccount user = requireUser(email);
        PasskeyChallenge challenge = consume(requestId)
                .filter(found -> user.getId().equals(found.getUserId()))
                .orElseThrow(() -> BusinessException.badRequest("Ha pasado demasiado tiempo. Vuelve a intentarlo."));
        ensureRoomForAnother(user);
        try {
            PublicKeyCredentialCreationOptions request = PublicKeyCredentialCreationOptions.fromJson(challenge.getRequestJson());
            RegistrationResult result = relyingParty.finishRegistration(FinishRegistrationOptions.builder()
                    .request(request)
                    .response(PublicKeyCredential.parseRegistrationResponseJson(credentialJson))
                    .build());
            Passkey saved = passkeyRepository.save(Passkey.builder()
                    .userId(user.getId())
                    .credentialId(result.getKeyId().getId().getBytes())
                    .userHandle(request.getUser().getId().getBytes())
                    .publicKeyCose(result.getPublicKeyCose().getBytes())
                    .signatureCount(result.getSignatureCount())
                    .name(cleanName(name))
                    .createdAt(Instant.now())
                    .build());
            log.info("Llave de acceso añadida (usuario {}).", user.getId());
            return PasskeyView.of(saved);
        } catch (RegistrationFailedException | IOException | IllegalArgumentException e) {
            log.info("Registro de llave de acceso rechazado (usuario {}): {}", user.getId(), e.getMessage());
            throw BusinessException.badRequest("No se ha podido guardar la llave de acceso.");
        }
    }

    /** Opciones para que el navegador ofrezca las llaves guardadas en el dispositivo. */
    @Transactional
    public Ceremony startLogin() {
        AssertionRequest request = relyingParty.startAssertion(StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.REQUIRED)
                .timeout(CHALLENGE_TTL.toMillis())
                .build());
        try {
            return newCeremony(null, request.toJson(), request.toCredentialsGetJson());
        } catch (IOException e) {
            throw new IllegalStateException("No se han podido serializar las opciones de acceso", e);
        }
    }

    /**
     * Comprueba la firma de la llave y abre una sesión de su cuenta. Vacío si no vale: reto
     * caducado o ya usado, llave desconocida (p. ej. borrada) o firma incorrecta.
     */
    @Transactional
    public Optional<SessionTokens> finishLogin(String requestId, String credentialJson) {
        Optional<PasskeyChallenge> challenge = consume(requestId).filter(found -> found.getUserId() == null);
        if (challenge.isEmpty()) {
            return Optional.empty();
        }
        try {
            AssertionResult result = relyingParty.finishAssertion(FinishAssertionOptions.builder()
                    .request(AssertionRequest.fromJson(challenge.get().getRequestJson()))
                    .response(PublicKeyCredential.parseAssertionResponseJson(credentialJson))
                    .build());
            if (!result.isSuccess()) {
                return Optional.empty();
            }
            Optional<Passkey> passkey = passkeyRepository.findByCredentialId(result.getCredential().getCredentialId().getBytes());
            passkey.ifPresent(used -> {
                used.setSignatureCount(result.getSignatureCount());
                used.setLastUsedAt(Instant.now());
            });
            return passkey
                    .flatMap(used -> userAccountRepository.findById(used.getUserId()))
                    .map(user -> {
                        log.info("Inicio de sesión con llave de acceso (usuario {}).", user.getId());
                        return sessionService.start(user);
                    });
        } catch (AssertionFailedException | IOException | IllegalArgumentException e) {
            log.info("Inicio de sesión con llave de acceso rechazado: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** Llaves de la cuenta, de la más antigua a la más reciente. */
    @Transactional(readOnly = true)
    public List<PasskeyView> list(String email) {
        UserAccount user = requireUser(email);
        return passkeyRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream().map(PasskeyView::of).toList();
    }

    /** Borra una llave de la cuenta. False si no existe o es de otra cuenta. */
    @Transactional
    public boolean delete(String email, Long passkeyId) {
        UserAccount user = requireUser(email);
        return passkeyRepository.findByIdAndUserId(passkeyId, user.getId())
                .map(passkey -> {
                    passkeyRepository.delete(passkey);
                    log.info("Llave de acceso borrada (usuario {}).", user.getId());
                    return true;
                })
                .orElse(false);
    }

    private Ceremony newCeremony(Long userId, String requestJson, String browserOptionsJson) {
        String id = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes());
        challengeRepository.save(PasskeyChallenge.builder()
                .id(id)
                .userId(userId)
                .requestJson(requestJson)
                .expiresAt(Instant.now().plus(CHALLENGE_TTL))
                .build());
        return new Ceremony(id, browserOptionsJson);
    }

    /** Gasta el reto y lo devuelve si aún no había caducado. */
    private Optional<PasskeyChallenge> consume(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            return Optional.empty();
        }
        Optional<PasskeyChallenge> found = challengeRepository.findByIdForUpdate(requestId);
        found.ifPresent(challengeRepository::delete);
        return found.filter(challenge -> Instant.now().isBefore(challenge.getExpiresAt()));
    }

    private void ensureRoomForAnother(UserAccount user) {
        if (passkeyRepository.countByUserId(user.getId()) >= MAX_PASSKEYS) {
            throw BusinessException.badRequest("Ya tienes " + MAX_PASSKEYS + " llaves de acceso. Borra alguna para añadir otra.");
        }
    }

    private UserAccount requireUser(String email) {
        return Optional.ofNullable(email)
                .flatMap(userAccountRepository::findByGoogleEmail)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
    }

    private static String displayName(UserAccount user) {
        String name = user.getParticipantName();
        return name != null && !name.isBlank() ? name : user.getGoogleEmail();
    }

    static String cleanName(String name) {
        String trimmed = name == null ? "" : name.strip().replaceAll("\\p{Cntrl}", "");
        if (trimmed.isEmpty()) {
            return "Llave de acceso";
        }
        return trimmed.length() > MAX_NAME_LENGTH ? trimmed.substring(0, MAX_NAME_LENGTH) : trimmed;
    }

    private static byte[] randomBytes() {
        byte[] bytes = new byte[RANDOM_ID_BYTES];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    /**
     * Ceremonia WebAuthn en curso.
     *
     * @param requestId          identificador del reto, para la respuesta del navegador
     * @param browserOptionsJson opciones para {@code navigator.credentials}, con su clave {@code publicKey}
     */
    public record Ceremony(String requestId, String browserOptionsJson) {
    }

    /** Llave tal como la ve su dueño en el perfil. */
    public record PasskeyView(Long id, String name, Instant createdAt, Instant lastUsedAt) {
        static PasskeyView of(Passkey passkey) {
            return new PasskeyView(passkey.getId(), passkey.getName(), passkey.getCreatedAt(), passkey.getLastUsedAt());
        }
    }
}
