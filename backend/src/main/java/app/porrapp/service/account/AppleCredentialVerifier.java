package app.porrapp.service.account;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.ProtectedHeader;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Verifica el ID token de «Iniciar sesión con Apple»: firma con las claves públicas de Apple,
 * emisor, audiencia (el Services ID) y caducidad.
 * <p>
 * Las claves se guardan una hora; si llega un token firmado con una clave desconocida (Apple las
 * rota) se vuelven a pedir, como mucho una vez por minuto.
 * </p>
 */
@Component
@Slf4j
public class AppleCredentialVerifier {

    static final String ISSUER = "https://appleid.apple.com";
    private static final URI KEYS_URL = URI.create("https://appleid.apple.com/auth/keys");
    private static final Duration KEYS_TTL = Duration.ofHours(1);
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofMinutes(1);

    private final String clientId;
    private final Function<URI, String> fetcher;
    private volatile Map<String, Key> keys = Map.of();
    private volatile Instant fetchedAt = Instant.EPOCH;

    @Autowired
    public AppleCredentialVerifier(@Value("${apple.client.id:}") String clientId) {
        this(clientId, AppleCredentialVerifier::download);
    }

    AppleCredentialVerifier(String clientId, Function<URI, String> fetcher) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.fetcher = fetcher;
    }

    /** Si hay Services ID configurado: sin él no se puede entrar con Apple. */
    public boolean enabled() {
        return !clientId.isEmpty();
    }

    /** Datos de la cuenta de Apple, o 401 si el token no es válido. */
    public AppleIdentity verify(String idToken) {
        if (!enabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "El inicio de sesión con Apple no está disponible.");
        }
        Claims claims;
        try {
            claims = Jwts.parser()
                    .keyLocator(new LocatorAdapter<>() {
                        @Override
                        protected Key locate(ProtectedHeader header) {
                            return keyFor(header.getKeyId());
                        }
                    })
                    .requireIssuer(ISSUER)
                    .requireAudience(clientId)
                    .build()
                    .parseSignedClaims(idToken)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("No se pudo verificar el token de Apple: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de Apple inválido");
        }
        return new AppleIdentity(claims.getSubject(), claims.get("email", String.class),
                isTrue(claims.get("email_verified")));
    }

    /** Apple manda email_verified como booleano o como texto ("true"). */
    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equals(value);
    }

    private Key keyFor(String keyId) {
        Key key = keyId == null ? null : keys.get(keyId);
        Instant now = Instant.now();
        boolean stale = now.isAfter(fetchedAt.plus(KEYS_TTL));
        boolean mayRefresh = now.isAfter(fetchedAt.plus(MIN_REFRESH_INTERVAL));
        if (stale || (key == null && mayRefresh)) {
            refreshKeys(now);
            key = keyId == null ? null : keys.get(keyId);
        }
        if (key == null) {
            throw new JwtException("Clave de Apple desconocida: " + keyId);
        }
        return key;
    }

    private synchronized void refreshKeys(Instant now) {
        if (!now.isAfter(fetchedAt.plus(MIN_REFRESH_INTERVAL)) && !keys.isEmpty()) {
            return; // Otro hilo acaba de traerlas.
        }
        try {
            JwkSet set = Jwks.setParser().build().parse(fetcher.apply(KEYS_URL));
            keys = set.getKeys().stream()
                    .filter(jwk -> jwk.getId() != null)
                    .collect(Collectors.toUnmodifiableMap(Jwk::getId, jwk -> (Key) jwk.toKey(), (a, b) -> a));
        } catch (RuntimeException e) {
            log.warn("No se pudieron descargar las claves de Apple: {}", e.getMessage());
        } finally {
            fetchedAt = now;
        }
    }

    private static String download(URI uri) {
        try (HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()) {
            HttpResponse<String> response = client.send(
                    HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Apple respondió " + response.statusCode());
            }
            return response.body();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /**
     * @param subject       claim "sub": identificador estable de la cuenta de Apple
     * @param email         email de la cuenta (puede ser una dirección de reenvío de Apple)
     * @param emailVerified si Apple ha verificado ese email
     */
    public record AppleIdentity(String subject, String email, boolean emailVerified) {
    }
}
