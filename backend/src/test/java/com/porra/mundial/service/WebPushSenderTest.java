package com.porra.mundial.service;

import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebPushSenderTest {

    @Test
    void encryptsAPayloadTheBrowserCanDecrypt() throws Exception {
        KeyPair browser = newKey();
        byte[] uaPublic = WebPushSender.encodePublicKey((ECPublicKey) browser.getPublic());
        byte[] auth = new byte[16];
        Arrays.fill(auth, (byte) 7);
        String message = "{\"title\":\"Te faltan 2 predicciones\"}";

        byte[] body = WebPushSender.encrypt(message.getBytes(StandardCharsets.UTF_8), uaPublic, auth);

        assertThat(new String(decrypt(body, (ECPrivateKey) browser.getPrivate(), uaPublic, auth),
                StandardCharsets.UTF_8)).isEqualTo(message);
    }

    @Test
    void rejectsKeysThatAreNotP256Points() {
        assertThatThrownBy(() -> WebPushSender.encrypt(new byte[]{1}, new byte[65], new byte[16]))
                .isInstanceOf(java.security.GeneralSecurityException.class);
    }

    @Test
    void staysDisabledWithoutValidVapidKeys() {
        assertThat(new WebPushSender("", "", "https://porra.raclos.es").isEnabled()).isFalse();
        assertThat(new WebPushSender("bad", "keys", "https://porra.raclos.es").isEnabled()).isFalse();
    }

    @Test
    void enablesWithAValidVapidKeyPair() throws Exception {
        KeyPair vapid = newKey();
        String publicKey = b64(WebPushSender.encodePublicKey((ECPublicKey) vapid.getPublic()));
        WebPushSender sender = new WebPushSender(publicKey, privateScalar(vapid), "https://porra.raclos.es");

        assertThat(sender.isEnabled()).isTrue();
        assertThat(sender.publicKey()).isEqualTo(publicKey);
    }

    @Test
    void neverPostsToHostsThatAreNotPushServices() throws Exception {
        KeyPair vapid = newKey();
        WebPushSender sender = new WebPushSender(
                b64(WebPushSender.encodePublicKey((ECPublicKey) vapid.getPublic())), privateScalar(vapid), "https://x");

        assertThat(sender.send("https://169.254.169.254/latest", "a", "b", "{}", 60))
                .isEqualTo(WebPushSender.Result.GONE);
    }

    /** Descifrado de RFC 8291 tal como lo hace el navegador. */
    private static byte[] decrypt(byte[] body, ECPrivateKey uaPrivate, byte[] uaPublic, byte[] auth) throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        buffer.get(salt);
        assertThat(buffer.getInt()).isEqualTo(4096);
        byte[] asPublic = new byte[buffer.get()];
        buffer.get(asPublic);
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(uaPrivate);
        agreement.doPhase(WebPushSender.decodePublicKey(asPublic), true);
        byte[] secret = agreement.generateSecret();
        byte[] info = ByteBuffer.allocate(14 + 65 + 65)
                .put("WebPush: info\0".getBytes(StandardCharsets.US_ASCII)).put(uaPublic).put(asPublic).array();
        byte[] ikm = WebPushSender.hkdf(auth, secret, info, 32);
        byte[] cek = WebPushSender.hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = WebPushSender.hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plain = cipher.doFinal(ciphertext);
        assertThat(plain[plain.length - 1]).isEqualTo((byte) 2);
        return Arrays.copyOf(plain, plain.length - 1);
    }

    private static KeyPair newKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(WebPushSender.p256());
        return generator.generateKeyPair();
    }

    /** La clave privada VAPID se configura como el escalar d de 32 bytes en base64url. */
    private static String privateScalar(KeyPair pair) {
        byte[] raw = ((ECPrivateKey) pair.getPrivate()).getS().toByteArray();
        byte[] d = new byte[32];
        int len = Math.min(32, raw.length);
        System.arraycopy(raw, raw.length - len, d, 32 - len, len);
        return b64(d);
    }

    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
