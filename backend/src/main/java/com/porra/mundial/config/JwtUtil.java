package com.porra.mundial.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/**
 * Firma y verifica los access tokens de la aplicación (JWT HS256).
 * <p>
 * El access token dura {@link #ACCESS_TOKEN_TTL} y no se puede revocar: lo que mantiene la
 * sesión es el refresh token ({@code SessionService}). Lleva la cabecera {@code typ: at+jwt}
 * (RFC 9068), {@code sub} con el id del usuario y el claim {@code email}, que es el nombre del
 * usuario autenticado en el resto del backend.
 * </p>
 * <p>
 * Transición: los JWT de 7 días que emitía la versión anterior (sin {@code typ}, con el email
 * en {@code sub}) se siguen aceptando hasta que caducan. Nada los emite ya, así que una semana
 * después del despliegue no queda ninguno y se puede borrar esa rama.
 * </p>
 */
@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    /**
     * 15 minutos: es lo que puede seguir usándose un access token robado tras un logout o tras
     * detectar una reutilización, porque no se puede revocar. Renovarlo cuesta una petición
     * cada 15 minutos de uso, y el WebSocket es anónimo, así que no hay conexiones largas que
     * dependan de él.
     */
    public static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(15);

    private static final String ACCESS_TOKEN_TYPE = "at+jwt";
    private static final String EMAIL_CLAIM = "email";

    // Clave criptográfica para firma y verificación HMAC-SHA256
    private final SecretKey key;

    // Lista de claves por defecto de ejemplo o inseguras que jamás deben aceptarse
    private static final java.util.Set<String> INSECURE_DEFAULT_SECRETS = java.util.Set.of(
            "1234567890123456789012345678901234567890",
            "super-secret-jwt-key-change-me-in-production",
            "your-256-bit-secret-your-256-bit-secret-here"
    );

    /**
     * Constructor que inyecta el secreto JWT.
     * Si no se provee en el entorno, es débil o es un valor de ejemplo:
     * - En producción: aborta el arranque lanzando IllegalStateException.
     * - En desarrollo/test: genera una clave criptográfica segura de 256 bits efímera en memoria.
     *
     * @param secret Clave secreta (mínimo 256 bits recomendados para HS256)
     */
    public JwtUtil(@Value("${app.jwt.secret:}") String secret) {
        boolean isInsecure = isSecretInsecure(secret);
        boolean isProd = isProductionProfile();

        if (isInsecure) {
            if (isProd) {
                throw new IllegalStateException(
                        "ERROR CRÍTICO DE SEGURIDAD: En perfil de producción es obligatorio configurar una variable " +
                        "JWT_SECRET robusta de al menos 32 bytes (256 bits) y que no sea una clave de ejemplo o plantilla.");
            }
            this.key = Jwts.SIG.HS256.key().build();
            log.warn("AVISO DE SEGURIDAD: La variable JWT_SECRET no está configurada o usa una clave de plantilla débil. " +
                     "Se ha generado una clave segura de 256 bits efímera en memoria para no interrumpir desarrollo/tests. " +
                     "Configura JWT_SECRET con un valor secreto robusto en producción.");
        } else {
            this.key = Keys.hmacShaKeyFor(secret.trim().getBytes(StandardCharsets.UTF_8));
            log.info("JwtUtil inicializado con éxito usando JWT_SECRET inyectado.");
        }
    }

    private static boolean isSecretInsecure(String secret) {
        if (secret == null || secret.isBlank()) return true;
        String trimmed = secret.trim();
        if (trimmed.getBytes(StandardCharsets.UTF_8).length < 32) return true;
        if (INSECURE_DEFAULT_SECRETS.contains(trimmed)) return true;
        String lower = trimmed.toLowerCase();
        return lower.contains("change-me") || lower.contains("example");
    }

    private static boolean isProductionProfile() {
        String activeProfile = System.getProperty("spring.profiles.active");
        if (activeProfile == null || activeProfile.isBlank()) {
            activeProfile = System.getenv("SPRING_PROFILES_ACTIVE");
        }
        return activeProfile != null && activeProfile.toLowerCase().contains("prod");
    }

    /** Access token de {@link #ACCESS_TOKEN_TTL} para el usuario. */
    public String generateAccessToken(Long userId, String email) {
        Instant now = Instant.now();
        return Jwts.builder()
                .header().type(ACCESS_TOKEN_TYPE).and()
                .subject(String.valueOf(userId))
                .claim(EMAIL_CLAIM, email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ACCESS_TOKEN_TTL)))
                .signWith(key)
                .compact();
    }

    /**
     * Comprueba firma y caducidad. Acepta los access tokens nuevos y los JWT de 7 días de la
     * versión anterior; cualquier otro {@code typ} se rechaza.
     */
    public Optional<VerifiedToken> verify(String token) {
        Jws<Claims> jws;
        try {
            jws = Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
        Claims claims = jws.getPayload();
        String type = jws.getHeader().getType();
        Instant expiresAt = claims.getExpiration() != null ? claims.getExpiration().toInstant() : null;
        if (expiresAt == null) {
            return Optional.empty();
        }
        String email = claims.get(EMAIL_CLAIM, String.class);

        if (ACCESS_TOKEN_TYPE.equals(type)) {
            Long userId = parseUserId(claims.getSubject());
            if (userId == null || email == null) return Optional.empty();
            return Optional.of(new VerifiedToken(email, userId, expiresAt, false));
        }
        if (type == null) {
            String legacyEmail = email != null ? email : claims.getSubject();
            if (legacyEmail == null) return Optional.empty();
            return Optional.of(new VerifiedToken(legacyEmail, null, expiresAt, true));
        }
        return Optional.empty();
    }

    private static Long parseUserId(String subject) {
        try {
            return subject != null ? Long.valueOf(subject) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Token con firma y caducidad válidas.
     *
     * @param email     nombre del usuario autenticado en el backend
     * @param userId    id del usuario; null en los JWT de la versión anterior
     * @param expiresAt caducidad (claim {@code exp})
     * @param legacy    JWT de 7 días de la versión anterior
     */
    public record VerifiedToken(String email, Long userId, Instant expiresAt, boolean legacy) {
    }
}
