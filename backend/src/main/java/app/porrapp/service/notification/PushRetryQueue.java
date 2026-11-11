package app.porrapp.service.notification;

import app.porrapp.repository.PushDeliveryRetryRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.model.PushDeliveryRetry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class PushRetryQueue {
    static final int MAX_TRACKED_ATTEMPTS = 3;
    static final long RECEIPT_WAIT_SECONDS = 120;
    private static final tools.jackson.databind.ObjectMapper MAPPER = tools.jackson.databind.json.JsonMapper.builder().build();
    private final PushDeliveryRetryRepository retries;
    private final PushSubscriptionRepository subscriptions;

    /** Se guarda antes de enviar: la confirmación puede llegar antes de la respuesta del proveedor. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PushDeliveryRetry prepare(String endpoint, Long userId, String payload, Instant now, int ttlSeconds) {
        var device = subscriptions.findByEndpoint(endpoint).orElse(null);
        if (device == null || !device.getUser().getId().equals(userId) || ttlSeconds < 1) return null;
        var pending = new PushDeliveryRetry();
        pending.setSubscriptionId(device.getId());
        pending.setUserId(userId);
        pending.setPayload(payload);
        pending.setReceiptToken(java.util.UUID.randomUUID());
        pending.setPayloadHash(hash(pending.getReceiptToken().toString()));
        pending.setReceiptExpected(device.isReceiptsEnabled());
        pending.setCreatedAt(now);
        pending.setExpiresAt(now.plusSeconds(ttlSeconds));
        pending.setNextAttemptAt(now.plusSeconds(RECEIPT_WAIT_SECONDS));
        pending.setAttempts(1);
        // El acuse no debe convertir un aviso válido en un mensaje que exceda el límite Web Push.
        if (wirePayload(pending).getBytes(StandardCharsets.UTF_8).length > 3993) return null;
        return retries.save(pending);
    }

    static String wirePayload(PushDeliveryRetry pending) {
        if (pending.getReceiptToken() == null) return pending.getPayload();
        var message = (tools.jackson.databind.node.ObjectNode) MAPPER.readTree(pending.getPayload());
        message.put("receiptToken", pending.getReceiptToken().toString());
        message.put("receiptExpiresAt", pending.getExpiresAt().plusSeconds(86400).toEpochMilli());
        return MAPPER.writeValueAsString(message);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sent(Long id, WebPushSender.Result result) {
        var pending = retries.findById(id).orElse(null);
        if (pending == null) return;
        if (result == WebPushSender.Result.GONE) {
            retries.delete(pending);
        } else if (result == WebPushSender.Result.SENT) {
            accepted(pending, Instant.now());
        }
    }

    static void accepted(PushDeliveryRetry pending, Instant now) {
        if (pending.getAcceptedAt() == null) pending.setAcceptedAt(now);
        // Las versiones antiguas no contestan; solo reintentamos entregas aceptadas en dispositivos
        // que ya han demostrado que ejecutan el protocolo de confirmación.
        if (!pending.isReceiptExpected()) pending.setFinishedAt(now);
    }

    @Transactional
    public void acknowledge(java.util.UUID token) {
        if (token == null) return;
        var pending = retries.findByReceiptToken(token).orElse(null);
        Instant now = Instant.now();
        if (pending == null || pending.getReceivedAt() != null
                || pending.getExpiresAt().plusSeconds(86400).isBefore(now)) return;
        var device = subscriptions.findById(pending.getSubscriptionId()).orElse(null);
        if (device == null || !device.getUser().getId().equals(pending.getUserId())) return;
        pending.setReceivedAt(now);
        pending.setFinishedAt(now);
        device.setReceiptsEnabled(true);
    }

    // El reintento sobrevive aunque la operación que originó el aviso termine después con un error.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean enqueue(String endpoint, Long userId, String payload, Instant startedAt, int ttlSeconds) {
        var subscription = subscriptions.findByEndpoint(endpoint).orElse(null);
        if (subscription == null || !subscription.getUser().getId().equals(userId)
                || !startedAt.plusSeconds(ttlSeconds).isAfter(Instant.now())) return false;
        retries.enqueue(subscription.getId(), subscription.getUser().getId(), payload, hash(payload),
                startedAt, startedAt.plusSeconds(ttlSeconds), Instant.now().plusSeconds(60));
        return true;
    }

    private static String hash(String payload) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
