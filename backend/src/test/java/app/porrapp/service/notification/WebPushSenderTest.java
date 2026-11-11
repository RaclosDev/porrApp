package app.porrapp.service.notification;

import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyFactory;
import java.security.spec.ECPrivateKeySpec;
import java.math.BigInteger;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.io.IOException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class WebPushSenderTest {

    @ParameterizedTest
    @ValueSource(ints = {201, 503, 410})
    void persistsBeforeSendingAndUsesTheSameReceiptTokenForEveryOutcome(int status) throws Exception {
        HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<Void>>any()))
                .thenReturn(response(status));
        PushRetryQueue queue = mock(PushRetryQueue.class);
        var tracked = new app.porrapp.model.PushDeliveryRetry();
        tracked.setId(9L);
        tracked.setPayload("{\"title\":\"Aviso\"}");
        tracked.setReceiptToken(java.util.UUID.randomUUID());
        tracked.setExpiresAt(java.time.Instant.now().plusSeconds(300));
        when(queue.prepare(anyString(), eq(7L), anyString(), any(), eq(300))).thenReturn(tracked);
        KeyPair vapid = newKey();
        WebPushSender sender = spy(new WebPushSender(b64(WebPushSender.encodePublicKey((ECPublicKey) vapid.getPublic())),
                privateScalar(vapid), "https://porrapp.app", queue, http));
        String browserKey = b64(WebPushSender.encodePublicKey((ECPublicKey) newKey().getPublic()));
        var result = sender.send("https://web.push.apple.com/test", browserKey, b64(new byte[16]), tracked.getPayload(), 300, 7L);
        assertThat(result).isEqualTo(status == 201 ? WebPushSender.Result.SENT : status == 410 ? WebPushSender.Result.GONE : WebPushSender.Result.QUEUED);
        var order = inOrder(queue, http);
        order.verify(queue).prepare(anyString(), eq(7L), anyString(), any(), eq(300));
        order.verify(http).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<Void>>any());
        order.verify(queue).sent(eq(9L), eq(status == 201 ? WebPushSender.Result.SENT : status == 410 ? WebPushSender.Result.GONE : WebPushSender.Result.FAILED));
        verify(sender).send(anyString(), anyString(), anyString(), contains(tracked.getReceiptToken().toString()), eq(300));
        verify(queue, never()).enqueue(anyString(), anyLong(), anyString(), any(), anyInt());
    }

    @Test
    void matchesTheIndependentRfc8291AppendixAVector() throws Exception {
        byte[] uaPublic = WebPushSender.b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        var publicKey = WebPushSender.decodePublicKey(WebPushSender.b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"));
        var privateKey = KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1,
                WebPushSender.b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw")), WebPushSender.p256()));
        byte[] encrypted = WebPushSender.encrypt("When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8),
                uaPublic, WebPushSender.b64("BTBZMqHH6r4Tts7J_aSIgg"), new KeyPair(publicKey, privateKey),
                WebPushSender.b64("DGv6ra1nlYgDCS1FRnbzlw"));
        assertThat(b64(encrypted)).isEqualTo("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
    }

    @ParameterizedTest
    @ValueSource(ints = {201, 404, 410, 429, 500, 503})
    void handlesProviderResponsesWithoutDeletingTemporaryFailures(int status) throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<Void> response = response(status);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<Void>>any()))
                .thenReturn(response);
        PushRetryQueue queue = mock(PushRetryQueue.class);
        when(queue.enqueue(anyString(), eq(7L), anyString(), any(), eq(300))).thenReturn(true);
        KeyPair vapid = newKey();
        WebPushSender sender = new WebPushSender(b64(WebPushSender.encodePublicKey((ECPublicKey) vapid.getPublic())),
                privateScalar(vapid), "https://porrapp.app", queue, http);
        String browserKey = b64(WebPushSender.encodePublicKey((ECPublicKey) newKey().getPublic()));
        var result = sender.send("https://web.push.apple.com/test", browserKey, b64(new byte[16]), "{}", 300, 7L);
        assertThat(result).isEqualTo(status == 201 ? WebPushSender.Result.SENT
                : status == 404 || status == 410 ? WebPushSender.Result.GONE : WebPushSender.Result.QUEUED);
        if (status < 429) verify(queue, never()).enqueue(anyString(), anyLong(), anyString(), any(), anyInt());
        else verify(queue).enqueue(eq("https://web.push.apple.com/test"), eq(7L), eq("{}"), any(), eq(300));
    }

    private static HttpResponse<Void> response(int status) {
        return new HttpResponse<>() {
            public int statusCode() { return status; }
            public HttpRequest request() { return null; }
            public java.util.Optional<HttpResponse<Void>> previousResponse() { return java.util.Optional.empty(); }
            public java.net.http.HttpHeaders headers() { return java.net.http.HttpHeaders.of(java.util.Map.of(), (a, b) -> true); }
            public Void body() { return null; }
            public java.util.Optional<javax.net.ssl.SSLSession> sslSession() { return java.util.Optional.empty(); }
            public java.net.URI uri() { return java.net.URI.create("https://web.push.apple.com/test"); }
            public HttpClient.Version version() { return HttpClient.Version.HTTP_2; }
        };
    }

    @Test
    void queuesNetworkFailuresAndKeepsSubscriptionsForOversizedPayloads() throws Exception {
        HttpClient http = mock(HttpClient.class);
        when(http.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<Void>>any()))
                .thenThrow(new IOException("network unavailable"));
        PushRetryQueue queue = mock(PushRetryQueue.class);
        when(queue.enqueue(anyString(), eq(7L), anyString(), any(), anyInt())).thenReturn(true);
        KeyPair vapid = newKey();
        WebPushSender sender = new WebPushSender(b64(WebPushSender.encodePublicKey((ECPublicKey) vapid.getPublic())),
                privateScalar(vapid), "https://porrapp.app", queue, http);
        String browserKey = b64(WebPushSender.encodePublicKey((ECPublicKey) newKey().getPublic()));
        assertThat(sender.send("https://fcm.googleapis.com/test", browserKey, b64(new byte[16]), "{}", 300, 7L))
                .isEqualTo(WebPushSender.Result.QUEUED);
        assertThat(sender.send("https://fcm.googleapis.com/test", browserKey, b64(new byte[16]), "x".repeat(3994), 300))
                .isEqualTo(WebPushSender.Result.FAILED);
        verify(http, times(1)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<Void>>any());
    }

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
        assertThat(new WebPushSender("", "", "https://porrapp.app").isEnabled()).isFalse();
        assertThat(new WebPushSender("bad", "keys", "https://porrapp.app").isEnabled()).isFalse();
    }

    @Test
    void enablesWithAValidVapidKeyPair() throws Exception {
        KeyPair vapid = newKey();
        String publicKey = b64(WebPushSender.encodePublicKey((ECPublicKey) vapid.getPublic()));
        WebPushSender sender = new WebPushSender(publicKey, privateScalar(vapid), "https://porrapp.app");

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
