package com.porra.mundial.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
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

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    // Clave criptográfica para firma y verificación HMAC-SHA256
    private final SecretKey key;

    // Lista de claves por defecto de ejemplo o inseguras que jamás deben aceptarse
    private static final java.util.Set<String> INSECURE_DEFAULT_SECRETS = java.util.Set.of(
            "1234567890123456789012345678901234567890",
            "super-secret-jwt-key-change-me-in-production",
            "your-256-bit-secret-your-256-bit-secret-here"
    );

    // Tiempo de expiración: 7 días (ajustable) en milisegundos
    private static final long EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000L;

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
