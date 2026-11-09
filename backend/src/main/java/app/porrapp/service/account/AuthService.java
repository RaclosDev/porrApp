package app.porrapp.service.account;

import app.porrapp.model.UserAccount;
import app.porrapp.repository.PasskeyRepository;
import app.porrapp.repository.RefreshTokenFamilyRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.account.AppleCredentialVerifier.AppleIdentity;
import app.porrapp.service.account.GoogleCredentialVerifier.GoogleIdentity;
import app.porrapp.service.account.SessionService.SessionTokens;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/**
 * Inicio de sesión con Google o Apple: verifica el ID token, encuentra la cuenta por el {@code sub} de
 * Google (la crea la primera vez, con un apodo único a partir del nombre de Google) y abre una
 * sesión.
 * <p>
 * Las cuentas anteriores a guardar el {@code sub} se asocian por email la primera vez que
 * entran; a partir de ahí manda el {@code sub} y el email guardado sigue al de Google.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserAccountRepository userAccountRepository;
    private static final int MAX_BASE_NAME_LENGTH = 40;

    private final GoogleCredentialVerifier googleCredentialVerifier;
    private final AppleCredentialVerifier appleCredentialVerifier;
    private final SessionService sessionService;
    private final RefreshTokenFamilyRepository refreshTokenFamilyRepository;
    private final PasskeyRepository passkeyRepository;

    @Transactional
    public SessionTokens loginWithGoogle(String credential) {
        GoogleIdentity google = googleCredentialVerifier.verify(credential);
        if (!google.emailVerified()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La dirección de correo de Google no está verificada.");
        }
        if (google.subject() == null || google.subject().isBlank() || google.email() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de Google inválido");
        }
        return sessionService.start(findOrRegister(google));
    }

    /**
     * Inicio de sesión con Apple. La cuenta se busca por el {@code sub} de Apple; la primera vez se
     * asocia por email verificado a la cuenta que ya lo tenga (de Google o con contraseña) o se crea.
     *
     * @param name nombre que Apple da al navegador solo la primera vez; propone el apodo
     */
    @Transactional
    public SessionTokens loginWithApple(String idToken, String name) {
        AppleIdentity apple = appleCredentialVerifier.verify(idToken);
        if (apple.subject() == null || apple.subject().isBlank() || apple.email() == null || apple.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de Apple inválido");
        }
        if (!apple.emailVerified()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La dirección de correo de Apple no está verificada.");
        }
        Optional<UserAccount> bySubject = userAccountRepository.findByAppleSub(apple.subject());
        if (bySubject.isPresent()) {
            return sessionService.start(bySubject.get());
        }

        String email = apple.email().trim().toLowerCase(Locale.ROOT);
        Optional<UserAccount> byEmail = userAccountRepository.findByGoogleEmail(email);
        if (byEmail.isPresent()) {
            UserAccount user = byEmail.get();
            if (user.getAppleSub() != null) {
                log.warn("El email del usuario {} lo usa ahora otra cuenta de Apple; no se inicia sesión.", user.getId());
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Este email ya está asociado a otra cuenta de Apple. Escribe al administrador de la porra.");
            }
            if (user.getPasswordHash() != null) {
                claimPasswordAccount(user);
            }
            user.setAppleSub(apple.subject());
            return sessionService.start(user);
        }

        String baseName = name != null && !name.isBlank() ? name.trim() : email.split("@")[0];
        UserAccount user = userAccountRepository.save(UserAccount.builder()
                .appleSub(apple.subject())
                .googleEmail(email)
                .participantName(uniqueParticipantName(baseName))
                .build());
        return sessionService.start(user);
    }

    private String uniqueParticipantName(String name) {
        String baseName = name.length() > MAX_BASE_NAME_LENGTH ? name.substring(0, MAX_BASE_NAME_LENGTH) : name;
        String participantName = baseName;
        for (int suffix = 1; userAccountRepository.existsByParticipantNameIgnoreCase(participantName); suffix++) {
            participantName = baseName + suffix;
        }
        return participantName;
    }

    private UserAccount findOrRegister(GoogleIdentity google) {
        Optional<UserAccount> bySubject = userAccountRepository.findByGoogleSub(google.subject());
        if (bySubject.isPresent()) {
            return followEmailChange(bySubject.get(), google.email());
        }

        Optional<UserAccount> byEmail = userAccountRepository.findByGoogleEmail(google.email());
        if (byEmail.isPresent()) {
            UserAccount user = byEmail.get();
            if (user.getGoogleSub() != null) {
                // El email pasó a otra cuenta de Google. Entrar con él no da acceso a la cuenta
                // anterior, y tampoco se le puede quitar el email a esa cuenta sin su dueño.
                log.warn("El email del usuario {} lo usa ahora otra cuenta de Google; no se inicia sesión.", user.getId());
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Este email ya está asociado a otra cuenta de Google. Escribe al administrador de la porra.");
            }
            if (user.getPasswordHash() != null) {
                claimPasswordAccount(user);
            }
            user.setGoogleSub(google.subject());
            return user;
        }

        return register(google);
    }

    /**
     * Google o Apple demuestran que el email es de quien entra; el registro con contraseña no lo comprobó.
     * Para que nadie conserve una cuenta creada con un email ajeno, la cuenta pasa a Google: se
     * borra la contraseña, se cierran sus sesiones y se quitan sus llaves de acceso.
     */
    private void claimPasswordAccount(UserAccount user) {
        log.info("El usuario {} se registró con contraseña y ahora entra con Google: la cuenta pasa a Google.", user.getId());
        user.setPasswordHash(null);
        refreshTokenFamilyRepository.revokeAllOfUser(user.getId(), Instant.now());
        passkeyRepository.deleteAllOfUser(user.getId());
    }

    /** Si la cuenta de Google ha cambiado de email, guarda el nuevo salvo que ya sea de otro usuario. */
    private UserAccount followEmailChange(UserAccount user, String email) {
        if (email.equals(user.getGoogleEmail())) {
            return user;
        }
        if (userAccountRepository.findByGoogleEmail(email).isPresent()) {
            log.warn("La cuenta de Google del usuario {} tiene un email que ya usa otro usuario; se mantiene el guardado.",
                    user.getId());
            return user;
        }
        user.setGoogleEmail(email);
        return user;
    }

    /** Alta automática con los datos de Google; el apodo se desambigua con un sufijo numérico. */
    private UserAccount register(GoogleIdentity google) {
        String email = google.email();
        String googleName = google.name();
        String baseName = googleName != null && !googleName.isBlank() ? googleName.trim() : email.split("@")[0];
        String participantName = baseName;
        for (int suffix = 1; userAccountRepository.existsByParticipantNameIgnoreCase(participantName); suffix++) {
            participantName = baseName + suffix;
        }
        return userAccountRepository.save(UserAccount.builder()
                .googleSub(google.subject())
                .googleEmail(email)
                .participantName(participantName)
                .build());
    }
}
