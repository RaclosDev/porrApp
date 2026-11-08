package com.porra.mundial.service.account;

import com.porra.mundial.model.PasswordResetToken;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PasskeyRepository;
import com.porra.mundial.repository.PasswordResetTokenRepository;
import com.porra.mundial.repository.RefreshTokenFamilyRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import com.porra.mundial.service.notification.EmailSender;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;

/**
 * Recuperar la contraseña: un enlace de un solo uso al email de la cuenta.
 * <ul>
 *   <li>Pedirlo responde igual exista o no la cuenta, para no revelar qué emails están registrados.</li>
 *   <li>Solo las cuentas con contraseña reciben el enlace; las de Google o Apple entran con ellos.</li>
 *   <li>El enlace vive {@link #TOKEN_TTL}; pedir otro anula el anterior, y como mucho uno por minuto.</li>
 *   <li>Solo se guarda el SHA-256 del token, que va en el fragmento (#) del enlace: el navegador no
 *       lo manda al servidor, así que no queda en logs ni en el Referer.</li>
 *   <li>Cambiarla cierra todas las sesiones y quita las llaves de acceso: quien la cambia demuestra
 *       que el email es suyo, y nadie que se registrara con un email ajeno conserva el acceso.</li>
 * </ul>
 */
@Service
@Slf4j
public class PasswordResetService {

    static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    private static final Duration MIN_INTERVAL = Duration.ofMinutes(1);
    private static final int TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PasswordResetTokenRepository tokenRepository;
    private final UserAccountRepository userAccountRepository;
    private final RefreshTokenFamilyRepository refreshTokenFamilyRepository;
    private final PasskeyRepository passkeyRepository;
    private final SessionService sessionService;
    private final EmailSender emailSender;
    private final String publicBaseUrl;

    public PasswordResetService(PasswordResetTokenRepository tokenRepository,
                                UserAccountRepository userAccountRepository,
                                RefreshTokenFamilyRepository refreshTokenFamilyRepository,
                                PasskeyRepository passkeyRepository,
                                SessionService sessionService,
                                EmailSender emailSender,
                                @Value("${app.public-base-url:https://porrapp.app}") String publicBaseUrl) {
        this.tokenRepository = tokenRepository;
        this.userAccountRepository = userAccountRepository;
        this.refreshTokenFamilyRepository = refreshTokenFamilyRepository;
        this.passkeyRepository = passkeyRepository;
        this.sessionService = sessionService;
        this.emailSender = emailSender;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    /** Manda el enlace si el email es de una cuenta con contraseña; si no, no hace nada. */
    @Transactional
    public void requestReset(String rawEmail) {
        if (!emailSender.enabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Ahora mismo no se puede recuperar la contraseña por correo.");
        }
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        UserAccount user = email.isEmpty() ? null : userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null || user.getPasswordHash() == null) {
            return;
        }
        Instant now = Instant.now();
        if (tokenRepository.existsByUserIdAndCreatedAtAfter(user.getId(), now.minus(MIN_INTERVAL))) {
            return;
        }
        tokenRepository.deleteExpired(now);
        tokenRepository.deleteByUserId(user.getId());
        String token = newToken();
        tokenRepository.save(PasswordResetToken.builder()
                .userId(user.getId())
                .tokenHash(SessionService.hash(token))
                .createdAt(now)
                .expiresAt(now.plus(TOKEN_TTL))
                .build());
        emailSender.send(PasswordResetEmail.build(user.getGoogleEmail(), user.getParticipantName(),
                publicBaseUrl + "/restablecer-contrasena#token=" + token, publicBaseUrl));
        log.info("Enlace para cambiar la contraseña enviado (usuario {}).", user.getId());
    }

    /** Gasta el enlace, pone la contraseña nueva y abre sesión. 400 si el enlace no vale. */
    @Transactional
    public SessionTokens reset(String token, String newPassword) {
        PasswordAuthService.validateNewPassword(newPassword);
        if (token == null || token.isBlank()) {
            throw invalidLink();
        }
        PasswordResetToken found = tokenRepository.findByTokenHashForUpdate(SessionService.hash(token))
                .orElseThrow(PasswordResetService::invalidLink);
        tokenRepository.delete(found);
        if (!Instant.now().isBefore(found.getExpiresAt())) {
            throw invalidLink();
        }
        UserAccount user = userAccountRepository.findById(found.getUserId())
                .filter(account -> account.getPasswordHash() != null)
                .orElseThrow(PasswordResetService::invalidLink);
        user.setPasswordHash(PasswordAuthService.hashPassword(newPassword));
        refreshTokenFamilyRepository.revokeAllOfUser(user.getId(), Instant.now());
        passkeyRepository.deleteAllOfUser(user.getId());
        log.info("Contraseña cambiada con el enlace del correo (usuario {}).", user.getId());
        return sessionService.start(user);
    }

    private static String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static ResponseStatusException invalidLink() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "El enlace ha caducado o ya se ha usado. Pide otro desde «¿Has olvidado la contraseña?».");
    }
}
