package app.porrapp.service.account;

import app.porrapp.config.JwtUtil;
import app.porrapp.model.RefreshToken;
import app.porrapp.model.RefreshTokenFamily;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PasskeyChallengeRepository;
import app.porrapp.repository.RefreshTokenFamilyRepository;
import app.porrapp.repository.RefreshTokenRepository;
import app.porrapp.repository.SessionHandoffRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Sesiones con refresh token opaco y rotatorio.
 * <ul>
 *   <li>Cada inicio de sesión abre una familia. Caduca tras {@link #SESSION_IDLE_TTL} sin usarse: cada
 *       refresco vuelve a contar el plazo, hasta {@link #SESSION_MAX_LIFETIME} desde el inicio de sesión.</li>
 *   <li>Cada refresco gasta el token presentado y entrega otro de la misma familia.</li>
 *   <li>Si llega un token gastado hace menos de {@link #REUSE_GRACE}, es un reintento tras perder
 *       la respuesta (red móvil): se entrega otro token de la misma familia sin revocarla.</li>
 *   <li>Si llega un token gastado hace más, alguien tiene una copia: se revoca la familia, y con ella
 *       tanto al atacante como al usuario legítimo, que tendrá que volver a entrar.</li>
 *   <li>En la base solo está el SHA-256 del token. Con 256 bits aleatorios no hace falta un hash lento.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    /** Una sesión que no se usa en este tiempo caduca. Cada refresco lo vuelve a contar. */
    public static final Duration SESSION_IDLE_TTL = Duration.ofDays(90);
    /** Tope de una sesión desde el inicio de sesión, por mucho que se use. */
    public static final Duration SESSION_MAX_LIFETIME = Duration.ofDays(365);
    /**
     * Cuánto se guardan los tokens ya rotados de una sesión viva para detectar su reutilización.
     * Pasado este tiempo, un token rotado es desconocido: no abre nada, pero tampoco revoca.
     */
    static final Duration REUSE_DETECTION_WINDOW = Duration.ofDays(30);
    /**
     * Margen en que un token recién rotado aún se acepta: cubre el reintento cuando se pierde la
     * respuesta del refresco. Un token robado y usado dentro de este margen no se detecta.
     */
    static final Duration REUSE_GRACE = Duration.ofSeconds(30);

    private static final Duration ACTIVITY_PRECISION = Duration.ofDays(1);
    private static final int REFRESH_TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenFamilyRepository familyRepository;
    private final RefreshTokenRepository tokenRepository;
    private final SessionHandoffRepository handoffRepository;
    private final PasskeyChallengeRepository passkeyChallengeRepository;
    private final JwtUtil jwtUtil;

    /** Abre una sesión nueva para el usuario. */
    @Transactional
    public SessionTokens start(UserAccount user) {
        Instant now = Instant.now();
        RefreshTokenFamily family = familyRepository.save(RefreshTokenFamily.builder()
                .user(user)
                .createdAt(now)
                .expiresAt(slidingExpiry(now, now))
                .build());
        return issue(family, user, now);
    }

    /**
     * Gasta el refresh token, entrega el siguiente de la misma familia y alarga la sesión
     * ({@link #SESSION_IDLE_TTL}, sin pasar de {@link #SESSION_MAX_LIFETIME}). Vacío si no vale:
     * desconocido, de una sesión cerrada o caducada, o gastado hace más de {@link #REUSE_GRACE}.
     * En el último caso se revoca la familia entera.
     */
    @Transactional
    public Optional<SessionTokens> refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return Optional.empty();
        }
        String tokenHash = hash(refreshToken);
        Optional<RefreshTokenFamily> locked = lockFamilyOf(tokenHash);
        if (locked.isEmpty()) {
            return Optional.empty();
        }
        RefreshTokenFamily family = locked.get();
        // Se lee con la familia ya bloqueada: si otra petición acaba de rotarlo, aquí se ve.
        RefreshToken token = tokenRepository.findByTokenHash(tokenHash).orElseThrow();
        Instant now = Instant.now();

        if (family.getRevokedAt() != null || !now.isBefore(family.getExpiresAt())) {
            return Optional.empty();
        }
        if (token.getRotatedAt() != null && now.isBefore(token.getRotatedAt().plus(REUSE_GRACE))) {
            log.info("Reintento de refresco dentro del margen (usuario {}, familia {}).",
                    family.getUser().getId(), family.getId());
            return Optional.of(extendAndIssue(family, now));
        }
        if (token.getRotatedAt() != null) {
            family.setRevokedAt(now);
            log.warn("Reutilización de un refresh token ya rotado (usuario {}, familia {}): se revoca la sesión.",
                    family.getUser().getId(), family.getId());
            return Optional.empty();
        }
        token.setRotatedAt(now);
        return Optional.of(extendAndIssue(family, now));
    }

    /**
     * Logout: revoca la familia del token y anula el traspaso a la app instalada que estuviera
     * pendiente. Un token desconocido no hace nada.
     */
    @Transactional
    public void end(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        lockFamilyOf(hash(refreshToken)).ifPresent(family -> {
            if (family.getRevokedAt() == null) {
                family.setRevokedAt(Instant.now());
            }
            handoffRepository.deleteByUserId(family.getUser().getId());
        });
    }

    /**
     * Borra cada noche las sesiones caducadas, que ya no sirven ni para detectar reutilizaciones,
     * los tokens rotados hace más de {@link #REUSE_DETECTION_WINDOW}, los traspasos caducados y los
     * retos de llaves de acceso que nadie completó.
     */
    @Scheduled(cron = "0 15 4 * * *")
    @SchedulerLock(name = "sessionCleanup", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
    @Transactional
    public void purgeExpiredSessions() {
        Instant now = Instant.now();
        int deleted = familyRepository.deleteExpired(now);
        if (deleted > 0) {
            log.info("Borradas {} sesiones caducadas.", deleted);
        }
        tokenRepository.deleteRotatedBefore(now.minus(REUSE_DETECTION_WINDOW));
        handoffRepository.deleteExpired(now);
        passkeyChallengeRepository.deleteExpired(now);
    }

    /** Caducidad tras usar la sesión en {@code now}: el plazo de inactividad, sin pasar del tope. */
    private static Instant slidingExpiry(Instant createdAt, Instant now) {
        Instant idle = now.plus(SESSION_IDLE_TTL);
        Instant max = createdAt.plus(SESSION_MAX_LIFETIME);
        return idle.isBefore(max) ? idle : max;
    }

    /** La familia está bloqueada: nadie más la alarga ni la revoca a la vez. */
    private SessionTokens extendAndIssue(RefreshTokenFamily family, Instant now) {
        family.setExpiresAt(slidingExpiry(family.getCreatedAt(), now));
        return issue(family, family.getUser(), now);
    }

    private SessionTokens issue(RefreshTokenFamily family, UserAccount user, Instant now) {
        markActive(user, now);
        String refreshToken = newRefreshToken();
        tokenRepository.save(RefreshToken.builder()
                .familyId(family.getId())
                .tokenHash(hash(refreshToken))
                .createdAt(now)
                .build());
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getGoogleEmail());
        return new SessionTokens(accessToken, refreshToken, family.getExpiresAt(), user);
    }

    /** Como mucho una escritura al día por usuario: basta para el plazo de cuentas inactivas. */
    private static void markActive(UserAccount user, Instant now) {
        Instant last = user.getLastActiveAt();
        if (last == null || last.isBefore(now.minus(ACTIVITY_PRECISION))) {
            user.setLastActiveAt(now);
        }
    }

    /** SELECT ... FOR UPDATE de la familia del token, sin cargar antes el token. */
    private Optional<RefreshTokenFamily> lockFamilyOf(String tokenHash) {
        return tokenRepository.findFamilyIdByTokenHash(tokenHash)
                .flatMap(familyRepository::findByIdForUpdate);
    }

    private static String newRefreshToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    /**
     * Tokens de una sesión recién abierta o rotada.
     *
     * @param accessToken      JWT de {@link JwtUtil#ACCESS_TOKEN_TTL}
     * @param refreshToken     valor del refresh token; solo viaja en la cookie
     * @param refreshExpiresAt caducidad de la sesión, para el Max-Age de la cookie
     * @param user             usuario de la sesión
     */
    public record SessionTokens(String accessToken, String refreshToken, Instant refreshExpiresAt, UserAccount user) {
    }
}
