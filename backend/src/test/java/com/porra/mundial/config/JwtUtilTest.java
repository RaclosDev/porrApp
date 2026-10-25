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
}
