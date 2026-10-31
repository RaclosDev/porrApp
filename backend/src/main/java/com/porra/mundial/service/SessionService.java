package com.porra.mundial.service;

import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.RefreshToken;
import com.porra.mundial.model.RefreshTokenFamily;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.RefreshTokenFamilyRepository;
import com.porra.mundial.repository.RefreshTokenRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
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
 *   <li>Cada inicio de sesión abre una familia que caduca a los {@link #SESSION_TTL}, se rote o no.</li>
 *   <li>Cada refresco gasta el token presentado y entrega otro de la misma familia.</li>
 *   <li>Si llega un token ya gastado, alguien tiene una copia: se revoca la familia, y con ella
 *       tanto al atacante como al usuario legítimo, que tendrá que volver a entrar.</li>
 *   <li>En la base solo está el SHA-256 del token. Con 256 bits aleatorios no hace falta un hash lento.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    /** Duración máxima de una sesión, contada desde el inicio de sesión. */
    public static final Duration SESSION_TTL = Duration.ofDays(30);

    private static final int REFRESH_TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenFamilyRepository familyRepository;
    private final RefreshTokenRepository tokenRepository;
    private final UserAccountRepository userAccountRepository;
    private final JwtUtil jwtUtil;

    /** Abre una sesión nueva para el usuario. */
    @Transactional
    public SessionTokens start(UserAccount user) {
        return start(user, Instant.now().plus(SESSION_TTL));
    }

    /**
     * Gasta el refresh token y entrega el siguiente de la misma familia. Vacío si no vale:
     * desconocido, de una sesión cerrada o caducada, o ya gastado. En el último caso se revoca
     * la familia entera.
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
        if (token.getRotatedAt() != null) {
            family.setRevokedAt(now);
            log.warn("Reutilización de un refresh token ya rotado (usuario {}, familia {}): se revoca la sesión.",
                    family.getUser().getId(), family.getId());
            return Optional.empty();
        }
        token.setRotatedAt(now);
        return Optional.of(issue(family, family.getUser(), now));
    }

    /** Logout: revoca la familia del token. Un token desconocido no hace nada. */
    @Transactional
    public void end(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        lockFamilyOf(hash(refreshToken)).ifPresent(family -> {
            if (family.getRevokedAt() == null) {
                family.setRevokedAt(Instant.now());
            }
        });
    }

    /**
     * Cambia un JWT de 7 días de la versión anterior por una sesión. Esa sesión caduca cuando
     * caducaría el JWT: el canje no da más tiempo del que ya daba el token guardado en
     * localStorage. Vacío si el token no es uno de esos o ya no es válido.
     */
    @Transactional
    public Optional<SessionTokens> exchangeLegacyToken(String legacyJwt) {
        return jwtUtil.verify(legacyJwt)
                .filter(JwtUtil.VerifiedToken::legacy)
                .flatMap(legacy -> userAccountRepository.findByGoogleEmail(legacy.email())
                        .map(user -> start(user, earliest(legacy.expiresAt(), Instant.now().plus(SESSION_TTL)))));
    }

    /** Borra cada noche las sesiones caducadas, que ya no sirven ni para detectar reutilizaciones. */
    @Scheduled(cron = "0 15 4 * * *")
    @Transactional
    public void purgeExpiredSessions() {
        int deleted = familyRepository.deleteExpired(Instant.now());
        if (deleted > 0) {
            log.info("Borradas {} sesiones caducadas.", deleted);
        }
    }

    private SessionTokens start(UserAccount user, Instant expiresAt) {
        Instant now = Instant.now();
        RefreshTokenFamily family = familyRepository.save(RefreshTokenFamily.builder()
                .user(user)
                .createdAt(now)
                .expiresAt(expiresAt)
                .build());
        return issue(family, user, now);
    }

    private SessionTokens issue(RefreshTokenFamily family, UserAccount user, Instant now) {
        String refreshToken = newRefreshToken();
        tokenRepository.save(RefreshToken.builder()
                .familyId(family.getId())
                .tokenHash(hash(refreshToken))
                .createdAt(now)
                .build());
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getGoogleEmail());
        return new SessionTokens(accessToken, refreshToken, family.getExpiresAt(), user);
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

    private static Instant earliest(Instant a, Instant b) {
        return a.isBefore(b) ? a : b;
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
