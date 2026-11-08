package com.porra.mundial.service.account;

import com.porra.mundial.service.account.AppleCredentialVerifier.AppleIdentity;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.PublicKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Firma, emisor, audiencia y rotación de claves del ID token de Apple, con claves generadas aquí. */
class AppleCredentialVerifierTest {

    private static final String CLIENT_ID = "app.porrapp.web";

    private static final String KEY_ID = "clave-1";

    private final KeyPair keyPair = Jwts.SIG.RS256.keyPair().build();
    private final AtomicInteger downloads = new AtomicInteger();

    /** JWKS como el de https://appleid.apple.com/auth/keys con la clave pública dada. */
    private static String jwks(PublicKey key) {
        RSAPublicKey rsa = (RSAPublicKey) key;
        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        return "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"" + KEY_ID + "\",\"use\":\"sig\",\"alg\":\"RS256\","
                + "\"n\":\"" + b64.encodeToString(unsigned(rsa.getModulus())) + "\","
                + "\"e\":\"" + b64.encodeToString(unsigned(rsa.getPublicExponent())) + "\"}]}";
    }

    private static byte[] unsigned(BigInteger value) {
        byte[] bytes = value.toByteArray();
        return bytes[0] == 0 ? Arrays.copyOfRange(bytes, 1, bytes.length) : bytes;
    }

    private AppleCredentialVerifier verifier(String clientId, PublicKey published) {
        String jwks = jwks(published);
        return new AppleCredentialVerifier(clientId, uri -> {
            downloads.incrementAndGet();
            return jwks;
        });
    }

    private String token(String issuer, String audience, Object emailVerified) {
        return Jwts.builder()
                .header().keyId(KEY_ID).and()
                .issuer(issuer)
                .audience().add(audience).and()
                .subject("001234.apple-sub")
                .claim("email", "ana@privaterelay.appleid.com")
                .claim("email_verified", emailVerified)
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(keyPair.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(status));
    }

    @Test
    void aValidTokenGivesTheAppleAccount() {
        AppleIdentity apple = verifier(CLIENT_ID, keyPair.getPublic())
                .verify(token(AppleCredentialVerifier.ISSUER, CLIENT_ID, "true"));

        assertThat(apple.subject()).isEqualTo("001234.apple-sub");
        assertThat(apple.email()).isEqualTo("ana@privaterelay.appleid.com");
        assertThat(apple.emailVerified()).isTrue();
    }

    @Test
    void tokensForAnotherAppOrIssuerAreRejected() {
        AppleCredentialVerifier verifier = verifier(CLIENT_ID, keyPair.getPublic());

        assertStatus(() -> verifier.verify(token(AppleCredentialVerifier.ISSUER, "otra.app", true)), HttpStatus.UNAUTHORIZED);
        assertStatus(() -> verifier.verify(token("https://evil.example", CLIENT_ID, true)), HttpStatus.UNAUTHORIZED);
        assertStatus(() -> verifier.verify("no-es-un-token"), HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aTokenSignedWithAnotherKeyIsRejected() {
        KeyPair other = Jwts.SIG.RS256.keyPair().build();

        assertStatus(() -> verifier(CLIENT_ID, other.getPublic()).verify(token(AppleCredentialVerifier.ISSUER, CLIENT_ID, true)),
                HttpStatus.UNAUTHORIZED);
    }

    @Test
    void keysAreCachedBetweenLogins() {
        AppleCredentialVerifier verifier = verifier(CLIENT_ID, keyPair.getPublic());

        verifier.verify(token(AppleCredentialVerifier.ISSUER, CLIENT_ID, true));
        verifier.verify(token(AppleCredentialVerifier.ISSUER, CLIENT_ID, true));

        assertThat(downloads).hasValue(1);
    }

    @Test
    void withoutAServicesIdAppleIsUnavailable() {
        AppleCredentialVerifier verifier = verifier("", keyPair.getPublic());

        assertThat(verifier.enabled()).isFalse();
        assertStatus(() -> verifier.verify(token(AppleCredentialVerifier.ISSUER, CLIENT_ID, true)),
                HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(downloads).hasValue(0);
    }
}
