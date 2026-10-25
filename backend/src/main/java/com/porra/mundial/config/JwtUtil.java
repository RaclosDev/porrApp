package com.porra.mundial.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * Componente utilitario encargado de todo el ciclo de vida de los tokens JWT (JSON Web Tokens).
 * <p>
 * Responsabilidades:
 * Generar nuevos tokens al hacer login.
 * Extraer información (Claims) de tokens recibidos en las peticiones.
 * Validar firmas y caducidades para garantizar la seguridad.
 * </p>
 */
@Component
public class JwtUtil {

    // Extrae la clave secreta desde application.properties o usa una fuerte por defecto si no existe.
    // En producción (Railway) siempre se debe inyectar a través de la variable de entorno JWT_SECRET.
    private final SecretKey key;

    // Tiempo de expiración: 7 días (ajustable) en milisegundos
    private static final long EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000L;

    /**
     * Constructor que inyecta el secreto JWT.
     * 
     * @param secret Clave secreta (mínimo 256 bits recomendados para el algoritmo HS256)
     */
        public JwtUtil(@Value("${app.jwt.secret:}") String secret) {
        if (secret == null || secret.isBlank() || "1234567890123456789012345678901234567890".equals(secret) || secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("FATAL: app.jwt.secret DEBE estar configurado y contener al menos 32 caracteres (256 bits). El secreto estático por defecto está prohibido.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Genera un token básico solo con el nombre de usuario (para retrocompatibilidad).
     * 
     * @param username El nombre de usuario (generalmente su email)
     * @return String JWT firmado
     */
    public String generateToken(String username) {
        return generateToken(username, null);
    }

    /**
     * Genera un token completo inyectando Claims personalizados.
     * 
     * @param username El 'subject' principal del token.
     * @param email El email real (se inyecta como un custom claim adicional).
     * @return String JWT firmado
     */
    public String generateToken(String username, String email) {
        var builder = Jwts.builder()
                .subject(username) // Claim estándar 'sub'
                .issuedAt(new Date()) // Claim estándar 'iat'
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME)); // Claim estándar 'exp'
        
        if (email != null) {
            builder.claim("email", email); // Custom claim 'email'
        }
        
        return builder.signWith(key)
                .compact(); // Compacta el header, payload y firma en la cadena String Base64Url
    }

    /**
     * Extrae el 'Subject' (username) del token JWT.
     * 
     * @param token El JWT en formato cadena.
     * @return El nombre de usuario, o null si el token es inválido/expirado.
     */
    public String extractUsername(String token) {
        try {
            return getClaims(token).getSubject();
        } catch (Exception e) {
            return null; // Token inválido o expirado
        }
    }

    /**
     * Extrae el custom claim 'email' del token JWT.
     * 
     * @param token El JWT en formato cadena.
     * @return El email, o null si no existe o el token es inválido.
     */
    public String extractEmail(String token) {
        try {
            return getClaims(token).get("email", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Valida matemáticamente la firma del token y comprueba que la fecha actual
     * sea estrictamente anterior a la fecha de expiración ('exp').
     * 
     * @param token El JWT en formato cadena.
     * @return true si es válido y está vigente, false en cualquier otro caso.
     */
    public boolean validateToken(String token) {
        try {
            Claims claims = getClaims(token);
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Método interno core que parsea el token usando la clave secreta del servidor.
     * Si el token fue alterado por un tercero, lanzará una SignatureException.
     * 
     * @param token El JWT en formato cadena.
     * @return El bloque de datos (Claims/Payload) del token.
     */
    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key) // Firma digital para evitar suplantaciones
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
