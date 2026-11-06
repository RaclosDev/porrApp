package com.porra.mundial.service.notification;

import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.InvalidKeyException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;

/**
 * Envía notificaciones Web Push (RFC 8030) cifradas con aes128gcm (RFC 8291) y firmadas con VAPID
 * (RFC 8292). Sirve igual para Chrome/Android (FCM), Safari/iOS (Apple) y Firefox (Mozilla).
 * Sin claves VAPID configuradas no envía nada.
 */
@Slf4j
@Component
public class WebPushSender {

    /** Resultado de un envío: entregado, dispositivo dado de baja (hay que borrarlo) o fallo temporal. */
    public enum Result { SENT, GONE, FAILED }

    private static final int RECORD_SIZE = 4096;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final ECParameterSpec P256 = p256();

    private final String publicKeyB64;
    private final ECPrivateKey privateKey;
    private final String subject;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public WebPushSender(@Value("${app.push.vapid-public-key:}") String publicKey,
                         @Value("${app.push.vapid-private-key:}") String privateKey,
                         @Value("${app.push.vapid-subject:https://porra.raclos.es}") String subject) {
        ECPrivateKey parsed = null;
        if (!publicKey.isBlank() && !privateKey.isBlank()) {
            try {
                decodePublicKey(b64(publicKey));
                parsed = decodePrivateKey(b64(privateKey));
            } catch (GeneralSecurityException | IllegalArgumentException e) {
                log.error("Claves VAPID no válidas: los avisos push quedan desactivados", e);
            }
        }
        this.privateKey = parsed;
        this.publicKeyB64 = parsed == null ? null : publicKey.trim();
        this.subject = subject;
    }

    public boolean isEnabled() {
        return privateKey != null;
    }

    /** Clave pública VAPID (base64url) que el navegador necesita para suscribirse; null si no hay. */
    public String publicKey() {
        return publicKeyB64;
    }

    /** Envía {@code payload} a un dispositivo. {@code ttlSeconds}: cuánto puede esperar si está apagado. */
    public Result send(String endpoint, String p256dh, String auth, String payload, int ttlSeconds) {
        if (!isEnabled()) return Result.FAILED;
        try {
            URI uri = URI.create(endpoint);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !PushSubscriptionService.isKnownPushService(uri.getHost())) return Result.GONE;
            byte[] body = encrypt(payload.getBytes(StandardCharsets.UTF_8), b64(p256dh), b64(auth));
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/octet-stream")
                    .header("Content-Encoding", "aes128gcm")
                    .header("TTL", String.valueOf(ttlSeconds))
                    .header("Urgency", "high")
                    .header("Authorization", "vapid t=" + vapidToken(uri) + ", k=" + publicKeyB64)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status >= 200 && status < 300) return Result.SENT;
            if (status == 404 || status == 410) return Result.GONE;
            log.warn("El servicio push respondió {} para {}", status, uri.getHost());
            return Result.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            // Suscripción con claves o URL corruptas: no se podrá entregar nunca.
            log.warn("Suscripción push no válida: {}", e.getMessage());
            return Result.GONE;
        } catch (Exception e) {
            log.warn("No se pudo enviar el aviso push: {}", e.getMessage());
            return Result.FAILED;
        }
    }

    private String vapidToken(URI endpoint) {
        String audience = endpoint.getScheme() + "://" + endpoint.getHost()
                + (endpoint.getPort() == -1 ? "" : ":" + endpoint.getPort());
        return Jwts.builder()
                .header().type("JWT").and()
                .audience().single(audience)
                .expiration(Date.from(Instant.now().plus(Duration.ofHours(12))))
                .subject(subject)
                .signWith(privateKey, Jwts.SIG.ES256)
                .compact();
    }

    /** Cifrado aes128gcm de RFC 8291 en un único registro. */
    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(P256, RANDOM);
        KeyPair ephemeral = generator.generateKeyPair();
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(plaintext, uaPublic, authSecret, ephemeral, salt);
    }

    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret, KeyPair ephemeral, byte[] salt)
            throws GeneralSecurityException {
        if (authSecret.length != 16) throw new InvalidKeyException("auth debe tener 16 bytes");
        if (plaintext.length + 17 > RECORD_SIZE) throw new IllegalArgumentException("Aviso demasiado largo");
        byte[] asPublic = encodePublicKey((ECPublicKey) ephemeral.getPublic());

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(ephemeral.getPrivate());
        agreement.doPhase(decodePublicKey(uaPublic), true);
        byte[] ecdhSecret = agreement.generateSecret();

        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic);
        byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
        byte[] cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        // 0x02: delimitador del último (y único) registro.
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[]{2}));

        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic);
        return concat(header.array(), ciphertext);
    }

    /** HKDF-SHA256 con un solo bloque de salida (basta para 32 bytes o menos). */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    static ECPublicKey decodePublicKey(byte[] point) throws GeneralSecurityException {
        if (point.length != 65 || point[0] != 4) throw new InvalidKeyException("Clave P-256 no válida");
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(point, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(point, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
    }

    private static ECPrivateKey decodePrivateKey(byte[] d) throws GeneralSecurityException {
        if (d.length != 32) throw new InvalidKeyException("La clave privada VAPID debe tener 32 bytes");
        return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), P256));
    }

    static byte[] encodePublicKey(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 4;
        copyUnsigned(key.getW().getAffineX(), out, 1);
        copyUnsigned(key.getW().getAffineY(), out, 33);
        return out;
    }

    private static void copyUnsigned(BigInteger value, byte[] out, int offset) {
        byte[] raw = value.toByteArray();
        int start = Math.max(0, raw.length - 32);
        int len = raw.length - start;
        System.arraycopy(raw, start, out, offset + 32 - len, len);
    }

    static byte[] b64(String value) {
        String clean = value.trim().replace('+', '-').replace('/', '_');
        while (clean.endsWith("=")) clean = clean.substring(0, clean.length() - 1);
        return Base64.getUrlDecoder().decode(clean);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }

    static ECParameterSpec p256() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("La JVM no soporta P-256", e);
        }
    }
}
