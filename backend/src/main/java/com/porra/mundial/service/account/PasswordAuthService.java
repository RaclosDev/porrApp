package com.porra.mundial.service.account;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Registro e inicio de sesión con email y contraseña, para quien no quiere entrar con Google.
 * <p>
 * El email no se verifica (no hay envío de correos): si después alguien entra con Google con ese
 * email, la cuenta pasa a Google y la contraseña se borra (ver {@link AuthService}).
 * </p>
 */
@Service
@RequiredArgsConstructor
public class PasswordAuthService {

    static final int MIN_PASSWORD_LENGTH = 8;
    /** BCrypt solo usa los primeros 72 bytes: más largas se rechazan en vez de recortarlas sin avisar. */
    static final int MAX_PASSWORD_BYTES = 72;
    private static final int MAX_EMAIL_LENGTH = 254;
    private static final int MAX_BASE_NAME_LENGTH = 40;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+$");

    private static final PasswordEncoder ENCODER = new BCryptPasswordEncoder(12);
    /** Con un email desconocido se compara contra este hash: la respuesta tarda lo mismo. */
    private static final String DUMMY_HASH = ENCODER.encode("porrapp-sin-cuenta");

    private static final String WRONG_CREDENTIALS = "Email o contraseña incorrectos.";

    private final UserAccountRepository userAccountRepository;
    private final SessionService sessionService;

    @Transactional
    public SessionTokens register(String rawEmail, String password) {
        String email = normalizeEmail(rawEmail);
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La contraseña debe tener al menos " + MIN_PASSWORD_LENGTH + " caracteres.");
        }
        if (tooLong(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña es demasiado larga.");
        }
        if (userAccountRepository.existsByGoogleEmailIgnoreCase(email)) {
            throw alreadyRegistered();
        }
        UserAccount user;
        try {
            user = userAccountRepository.saveAndFlush(UserAccount.builder()
                    .googleEmail(email)
                    .passwordHash(ENCODER.encode(password))
                    .participantName(uniqueParticipantName(email))
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Otro registro con el mismo email se ha adelantado.
            throw alreadyRegistered();
        }
        return sessionService.start(user);
    }

    @Transactional
    public SessionTokens login(String rawEmail, String password) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        UserAccount user = email.isEmpty() ? null : userAccountRepository.findByGoogleEmail(email).orElse(null);
        String hash = user != null ? user.getPasswordHash() : null;
        boolean matches = password != null && !tooLong(password)
                && ENCODER.matches(password, hash != null ? hash : DUMMY_HASH);
        if (user != null && hash == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Esta cuenta entra con Google. Usa «Continuar con Google».");
        }
        if (!matches || user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_CREDENTIALS);
        }
        return sessionService.start(user);
    }

    private static String normalizeEmail(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        if (email.length() > MAX_EMAIL_LENGTH || !EMAIL.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe un email válido.");
        }
        return email;
    }

    private static boolean tooLong(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES;
    }

    /** Apodo provisional a partir del email; el usuario lo cambia al completar su perfil. */
    private String uniqueParticipantName(String email) {
        String local = email.substring(0, email.indexOf('@'));
        String baseName = local.length() > MAX_BASE_NAME_LENGTH ? local.substring(0, MAX_BASE_NAME_LENGTH) : local;
        String participantName = baseName;
        for (int suffix = 1; userAccountRepository.existsByParticipantNameIgnoreCase(participantName); suffix++) {
            participantName = baseName + suffix;
        }
        return participantName;
    }

    private static ResponseStatusException alreadyRegistered() {
        return new ResponseStatusException(HttpStatus.CONFLICT,
                "Ya hay una cuenta con este email. Inicia sesión con ella.");
    }
}
