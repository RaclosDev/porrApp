package com.porra.mundial.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    // Extrae la clave secreta desde application.properties o usa una fuerte por defecto si no existe.
    // En producción (Railway) siempre se debe inyectar a través de la variable de entorno JWT_SECRET.
    private final SecretKey key;

    public JwtUtil(@Value("${app.jwt.secret:1234567890123456789012345678901234567890}") String secret) {
        // Aseguramos de que el secret tiene el formato correcto (al menos 256 bits para HS256)
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    // Tiempo de expiración: 7 días (ajustable)
    private static final long EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000L;

    public String generateToken(String username) {
        return generateToken(username, null);
    }

    public String generateToken(String username, String email) {
        var builder = Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME));
        
        if (email != null) {
            builder.claim("email", email);
        }
        
        return builder.signWith(key)
                .compact();
    }

    public String extractUsername(String token) {
        try {
            return getClaims(token).getSubject();
        } catch (Exception e) {
            return null; // Token inválido o expirado
        }
    }

    public String extractEmail(String token) {
        try {
            return getClaims(token).get("email", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    public boolean validateToken(String token) {
        try {
            Claims claims = getClaims(token);
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
