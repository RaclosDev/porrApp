package com.porra.mundial.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private static final String SECRET = "un-secreto-muy-seguro-de-mas-de-32-caracteres-123456";

    /** JWT como los que emitía la versión anterior: sin typ, email en sub y en el claim email, 7 días. */
    static String legacyToken(String secret, String subject, String email, Instant expiresAt) {
        var builder = Jwts.builder()
                .subject(subject)
                .issuedAt(Date.from(expiresAt.minus(Duration.ofDays(7))))
                .expiration(Date.from(expiresAt));
        if (email != null) builder.claim("email", email);
        return builder.signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Test
    @DisplayName("El access token lleva typ at+jwt, el id en sub y el email, y dura 15 minutos")
    void accessTokenRoundTrip() {
        JwtUtil jwtUtil = new JwtUtil(SECRET);

        String token = jwtUtil.generateAccessToken(42L, "ana@test.com");
        JwtUtil.VerifiedToken verified = jwtUtil.verify(token).orElseThrow();

        assertEquals("ana@test.com", verified.email());
        assertEquals(42L, verified.userId());
        assertFalse(verified.legacy());
        long minutes = Duration.between(Instant.now(), verified.expiresAt()).toMinutes();
        assertTrue(minutes >= 14 && minutes <= 15, "caduca en " + minutes + " minutos");
        String header = new String(Base64.getUrlDecoder().decode(token.split("\\.")[0]), StandardCharsets.UTF_8);
        assertTrue(header.contains("\"typ\":\"at+jwt\""), header);
    }

    @Test
    @DisplayName("Los JWT de 7 días de la versión anterior se aceptan hasta que caducan")
    void acceptsLegacyTokensUntilTheyExpire() {
        JwtUtil jwtUtil = new JwtUtil(SECRET);
        Instant expiresAt = Instant.now().plus(Duration.ofDays(3));

        JwtUtil.VerifiedToken verified = jwtUtil.verify(legacyToken(SECRET, "ana@test.com", "ana@test.com", expiresAt))
                .orElseThrow();
        assertTrue(verified.legacy());
        assertEquals("ana@test.com", verified.email());
        assertNull(verified.userId());
        assertEquals(expiresAt.getEpochSecond(), verified.expiresAt().getEpochSecond());

        // Sin claim email, el usuario es el sub.
        assertEquals("Ana", jwtUtil.verify(legacyToken(SECRET, "Ana", null, expiresAt)).orElseThrow().email());

        assertTrue(jwtUtil.verify(legacyToken(SECRET, "ana@test.com", "ana@test.com",
                Instant.now().minusSeconds(1))).isEmpty());
    }

    @Test
    @DisplayName("Rechaza tokens caducados, de otra clave, de otro tipo o mal formados")
    void rejectsInvalidTokens() {
        JwtUtil jwtUtil = new JwtUtil(SECRET);
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

        String expired = Jwts.builder().header().type("at+jwt").and()
                .subject("42").claim("email", "ana@test.com")
                .expiration(Date.from(Instant.now().minusSeconds(5)))
                .signWith(key).compact();
        String otherType = Jwts.builder().header().type("JWT").and()
                .subject("42").claim("email", "ana@test.com")
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(key).compact();
        String withoutExpiry = Jwts.builder().header().type("at+jwt").and()
                .subject("42").claim("email", "ana@test.com")
                .signWith(key).compact();
        String otherKey = new JwtUtil("otro-secreto-distinto-de-mas-de-32-caracteres-999")
                .generateAccessToken(42L, "ana@test.com");

        assertTrue(jwtUtil.verify(expired).isEmpty());
        assertTrue(jwtUtil.verify(otherType).isEmpty());
        assertTrue(jwtUtil.verify(withoutExpiry).isEmpty());
        assertTrue(jwtUtil.verify(otherKey).isEmpty());
        assertTrue(jwtUtil.verify("no-es-un-jwt").isEmpty());
        assertTrue(jwtUtil.verify("").isEmpty());
    }

    @Test
    @DisplayName("Genera clave en memoria segura sin fallar si secret es nulo, corto o de plantilla")
    void insecureSecretFallsBackToAnEphemeralKey() {
        for (String secret : new String[] {"", "1234567890123456789012345678901234567890",
                "super-secret-jwt-key-change-me-in-production"}) {
            JwtUtil jwtUtil = new JwtUtil(secret);
            String token = jwtUtil.generateAccessToken(1L, "fallback@test.com");
            assertEquals("fallback@test.com", jwtUtil.verify(token).orElseThrow().email());
        }
        // La clave efímera no es el secreto de plantilla: un token firmado con él no vale.
        String template = "super-secret-jwt-key-change-me-in-production";
        assertTrue(new JwtUtil(template).verify(legacyToken(template, "x@test.com", "x@test.com",
                Instant.now().plusSeconds(60))).isEmpty());
    }

    @Test
    @DisplayName("Lanza IllegalStateException en perfil de producción si JWT_SECRET es inseguro")
    void testFailsInProductionWithInsecureSecret() {
        String prev = System.getProperty("spring.profiles.active");
        try {
            System.setProperty("spring.profiles.active", "prod");
            assertThrows(IllegalStateException.class, () -> new JwtUtil("super-secret-jwt-key-change-me-in-production"));
            assertThrows(IllegalStateException.class, () -> new JwtUtil(""));
            assertThrows(IllegalStateException.class, () -> new JwtUtil("too-short-key"));
        } finally {
            if (prev != null) {
                System.setProperty("spring.profiles.active", prev);
            } else {
                System.clearProperty("spring.profiles.active");
            }
        }
    }
}
