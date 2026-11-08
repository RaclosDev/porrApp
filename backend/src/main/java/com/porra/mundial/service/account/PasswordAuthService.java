package com.porra.mundial.service.account;

import com.porra.mundial.model.PendingRegistration;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PendingRegistrationRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import com.porra.mundial.service.notification.EmailSender;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Registro e inicio de sesión con email y contraseña, para quien no quiere entrar con Google.
 * <ul>
 *   <li>Registrarse manda un código de 6 dígitos al email y la cuenta solo se crea al escribirlo: así
 *       nadie crea cuentas con un email ajeno. Para confirmarlo hay que repetir la contraseña, para
 *       que nadie que pida otro código con el mismo email pueda colar la suya.</li>
 *   <li>La respuesta al registrarse es la misma tenga o no cuenta el email; si ya la tiene, se le
 *       avisa por correo. Así la pantalla no revela qué emails están registrados.</li>
 *   <li>Sin proveedor de correo configurado se crea la cuenta al momento, como antes. Si después
 *       alguien entra con Google con ese email, la cuenta pasa a Google (ver {@link AuthService}).</li>
 *   <li>Además del límite por IP, {@link #MAX_FAILED_LOGINS} fallos con un email lo bloquean
 *       {@link #FAILED_LOGIN_WINDOW}.</li>
 * </ul>
 */
@Service
@Slf4j
public class PasswordAuthService {

    static final Duration CODE_TTL = Duration.ofMinutes(15);
    static final int MAX_CODE_ATTEMPTS = 5;
    static final int MAX_FAILED_LOGINS = 10;
    static final Duration FAILED_LOGIN_WINDOW = Duration.ofMinutes(15);

    private static final int MAX_EMAIL_LENGTH = 254;
    private static final int MAX_BASE_NAME_LENGTH = 40;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final PasswordEncoder ENCODER = new BCryptPasswordEncoder(12);
    /** Con un email desconocido se compara contra este hash: la respuesta tarda lo mismo. */
    private static final String DUMMY_HASH = ENCODER.encode("porrapp-sin-cuenta");

    static final String WRONG_CREDENTIALS =
            "Email o contraseña incorrectos. Si tu cuenta es de Google o Apple, entra con ese botón.";

    private final UserAccountRepository userAccountRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final SessionService sessionService;
    private final EmailSender emailSender;
    private final AccountEmailThrottle emailThrottle;
    private final String publicBaseUrl;
    private final EmailKeyedLimiter failedLogins =
            new EmailKeyedLimiter(MAX_FAILED_LOGINS, FAILED_LOGIN_WINDOW, Clock.systemUTC());

    public PasswordAuthService(UserAccountRepository userAccountRepository,
                               PendingRegistrationRepository pendingRegistrationRepository,
                               SessionService sessionService,
                               EmailSender emailSender,
                               AccountEmailThrottle emailThrottle,
                               @Value("${app.public-base-url:https://porrapp.app}") String publicBaseUrl) {
        this.userAccountRepository = userAccountRepository;
        this.pendingRegistrationRepository = pendingRegistrationRepository;
        this.sessionService = sessionService;
        this.emailSender = emailSender;
        this.emailThrottle = emailThrottle;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    /**
     * Empieza el registro. Con correo configurado manda el código (o el aviso de que ya hay cuenta) y
     * devuelve vacío; sin correo crea la cuenta y devuelve la sesión.
     */
    @Transactional
    public Optional<SessionTokens> register(String rawEmail, String password) {
        String email = normalizeEmail(rawEmail);
        PasswordPolicy.validate(password, email);
        if (!emailSender.enabled()) {
            return Optional.of(registerWithoutCode(email, password));
        }
        if (!emailThrottle.tryAcquire(email)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Te acabamos de mandar un correo. Míralo o espera un minuto para pedir otro.");
        }
        // El hash se calcula siempre, para que tarde lo mismo haya cuenta o no.
        String passwordHash = ENCODER.encode(password);
        Optional<UserAccount> existing = userAccountRepository.findFirstByGoogleEmailIgnoreCase(email);
        if (existing.isPresent()) {
            UserAccount user = existing.get();
            String provider = user.getPasswordHash() == null ? AccountNoticeEmails.provider(user) : null;
            emailSender.send(AccountNoticeEmails.alreadyRegistered(user.getGoogleEmail(), user.getParticipantName(),
                    provider, publicBaseUrl));
            log.info("Registro con un email que ya tiene cuenta (usuario {}): se le avisa por correo.", user.getId());
            return Optional.empty();
        }

        Instant now = Instant.now();
        pendingRegistrationRepository.deleteExpired(now);
        String code = newCode();
        PendingRegistration pending = pendingRegistrationRepository.findByEmailForUpdate(email)
                .orElseGet(() -> PendingRegistration.builder().email(email).build());
        pending.setPasswordHash(passwordHash);
        pending.setCodeHash(codeHash(email, code));
        pending.setAttempts(0);
        pending.setCreatedAt(now);
        pending.setExpiresAt(now.plus(CODE_TTL));
        pendingRegistrationRepository.save(pending);
        emailSender.send(AccountNoticeEmails.registrationCode(email, code, CODE_TTL.toMinutes(), publicBaseUrl));
        return Optional.empty();
    }

    /**
     * Termina el registro con el código del correo y la misma contraseña: crea la cuenta y abre
     * sesión. 400 si no coinciden; a los {@link #MAX_CODE_ATTEMPTS} fallos el código deja de valer.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public SessionTokens confirmRegistration(String rawEmail, String code, String password) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        PendingRegistration pending = pendingRegistrationRepository.findByEmailForUpdate(email)
                .orElseThrow(PasswordAuthService::expiredCode);
        if (!Instant.now().isBefore(pending.getExpiresAt())) {
            pendingRegistrationRepository.delete(pending);
            throw expiredCode();
        }
        String typed = code == null ? "" : code.replaceAll("\\s", "");
        boolean codeMatches = MessageDigest.isEqual(
                codeHash(email, typed).getBytes(StandardCharsets.UTF_8),
                pending.getCodeHash().getBytes(StandardCharsets.UTF_8));
        boolean passwordMatches = password != null && !PasswordPolicy.tooLong(password)
                && ENCODER.matches(password, pending.getPasswordHash());
        if (!codeMatches || !passwordMatches) {
            pending.setAttempts(pending.getAttempts() + 1);
            if (pending.getAttempts() >= MAX_CODE_ATTEMPTS) {
                pendingRegistrationRepository.delete(pending);
                throw expiredCode();
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El código no es correcto. Revísalo en el correo.");
        }
        pendingRegistrationRepository.delete(pending);
        pendingRegistrationRepository.flush();
        if (userAccountRepository.existsByGoogleEmailIgnoreCase(email)) {
            // Mientras tanto ha entrado con Google o Apple con este email.
            throw alreadyRegistered();
        }
        return createAccount(email, pending.getPasswordHash());
    }

    @Transactional
    public SessionTokens login(String rawEmail, String password) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        if (!email.isEmpty() && failedLogins.exhausted(email)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Demasiados intentos con este email. Espera 15 minutos o cambia la contraseña con «¿Has olvidado la contraseña?».");
        }
        UserAccount user = email.isEmpty() ? null : userAccountRepository.findByGoogleEmail(email).orElse(null);
        String hash = user != null ? user.getPasswordHash() : null;
        boolean matches = password != null && !PasswordPolicy.tooLong(password)
                && ENCODER.matches(password, hash != null ? hash : DUMMY_HASH);
        // Mismo mensaje si el email no existe o la cuenta es de Google: no se revela cuál.
        if (!matches || user == null || hash == null) {
            if (!email.isEmpty()) {
                failedLogins.record(email);
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_CREDENTIALS);
        }
        failedLogins.reset(email);
        return sessionService.start(user);
    }

    /** Sin correo configurado: crea la cuenta al momento (409 si el email ya tiene una). */
    private SessionTokens registerWithoutCode(String email, String password) {
        if (userAccountRepository.existsByGoogleEmailIgnoreCase(email)) {
            throw alreadyRegistered();
        }
        return createAccount(email, ENCODER.encode(password));
    }

    private SessionTokens createAccount(String email, String passwordHash) {
        UserAccount user;
        try {
            user = userAccountRepository.saveAndFlush(UserAccount.builder()
                    .googleEmail(email)
                    .passwordHash(passwordHash)
                    .participantName(uniqueParticipantName(email))
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Otro registro con el mismo email se ha adelantado.
            throw alreadyRegistered();
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

    /** Hash BCrypt de una contraseña ya validada. */
    static String hashPassword(String password) {
        return ENCODER.encode(password);
    }

    private static String newCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private static String codeHash(String email, String code) {
        return SessionService.hash(email + ":" + code);
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

    private static ResponseStatusException expiredCode() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "El código ha caducado o ya no vale. Vuelve a pedir uno.");
    }

    private static ResponseStatusException alreadyRegistered() {
        return new ResponseStatusException(HttpStatus.CONFLICT,
                "Ya hay una cuenta con este email. Inicia sesión con ella.");
    }
}
