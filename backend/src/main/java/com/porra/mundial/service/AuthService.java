package com.porra.mundial.service;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.GoogleCredentialVerifier.GoogleIdentity;
import com.porra.mundial.service.SessionService.SessionTokens;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/**
 * Inicio de sesión con Google: verifica el ID token, encuentra la cuenta por el {@code sub} de
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
    private final GoogleCredentialVerifier googleCredentialVerifier;
    private final SessionService sessionService;

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
            user.setGoogleSub(google.subject());
            return user;
        }

        return register(google);
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
                .googleName(googleName != null ? googleName : participantName)
                .participantName(participantName)
                .build());
    }
}
