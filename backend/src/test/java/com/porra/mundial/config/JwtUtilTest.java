package com.porra.mundial.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    @Test
    @DisplayName("Inicializa correctamente con clave de más de 32 caracteres")
    void testInitWithValidSecret() {
        String secret = "un-secreto-muy-seguro-de-mas-de-32-caracteres-123456";
        JwtUtil jwtUtil = new JwtUtil(secret);

        String token = jwtUtil.generateToken("testUser", "test@example.com");
        assertNotNull(token);
        assertTrue(jwtUtil.validateToken(token));
        assertEquals("testUser", jwtUtil.extractUsername(token));
        assertEquals("test@example.com", jwtUtil.extractEmail(token));
    }

    @Test
    @DisplayName("Genera clave en memoria segura sin fallar si secret es nulo o vacío")
    void testInitWithEmptySecretFallback() {
        JwtUtil jwtUtil = new JwtUtil("");
        String token = jwtUtil.generateToken("fallbackUser");
        assertNotNull(token);
        assertTrue(jwtUtil.validateToken(token));
        assertEquals("fallbackUser", jwtUtil.extractUsername(token));
    }

    @Test
    @DisplayName("Genera clave en memoria segura si secret es el antiguo dummy o demasiado corto")
    void testInitWithShortOrDummySecretFallback() {
        JwtUtil jwtUtil = new JwtUtil("1234567890123456789012345678901234567890");
        String token = jwtUtil.generateToken("dummyUser");
        assertNotNull(token);
        assertTrue(jwtUtil.validateToken(token));
    }

    @Test
    @DisplayName("Rechaza secreto de plantilla de ejemplo y usa clave efímera segura en modo no-prod")
    void testInitWithTemplateSecretFallback() {
        JwtUtil jwtUtil = new JwtUtil("super-secret-jwt-key-change-me-in-production");
        String token = jwtUtil.generateToken("templateUser");
        assertNotNull(token);
        assertTrue(jwtUtil.validateToken(token));
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
