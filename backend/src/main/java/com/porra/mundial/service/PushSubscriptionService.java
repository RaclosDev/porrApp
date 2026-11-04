package com.porra.mundial.service;

import com.porra.mundial.dto.PushConfigResponse;
import com.porra.mundial.dto.PushSubscriptionRequest;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;

/** Dispositivos suscritos a avisos push y preferencias de avisos de cada usuario. */
@Service
@RequiredArgsConstructor
public class PushSubscriptionService {

    private static final int MAX_ENDPOINT_LENGTH = 2048;
    private static final int MAX_KEY_LENGTH = 255;

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserAccountRepository userAccountRepository;
    private final WebPushSender sender;

    @Transactional(readOnly = true)
    public PushConfigResponse config(String email) {
        UserAccount user = findUser(email);
        return new PushConfigResponse(sender.publicKey(), user.isMatchRemindersEnabled(),
                user.isMemberJoinedAlertsEnabled());
    }

    /** Guarda el dispositivo; si ya estaba con otra cuenta (cambio de sesión), pasa a esta. */
    @Transactional
    public void subscribe(String email, PushSubscriptionRequest request) {
        String endpoint = validEndpoint(request.endpoint());
        String p256dh = validKey(request.p256dh());
        String auth = validKey(request.auth());
        UserAccount user = findUser(email);
        PushSubscription subscription = subscriptionRepository.findByEndpoint(endpoint)
                .orElseGet(() -> PushSubscription.builder().endpoint(endpoint).build());
        subscription.setUser(user);
        subscription.setP256dh(p256dh);
        subscription.setAuth(auth);
        subscriptionRepository.save(subscription);
    }

    @Transactional
    public void unsubscribe(String email, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return;
        subscriptionRepository.deleteByEndpointAndUserId(endpoint.trim(), findUser(email).getId());
    }

    @Transactional
    public void setPreferences(String email, Boolean remindersEnabled, Boolean memberJoinedEnabled) {
        UserAccount user = findUser(email);
        if (remindersEnabled != null) user.setMatchRemindersEnabled(remindersEnabled);
        if (memberJoinedEnabled != null) user.setMemberJoinedAlertsEnabled(memberJoinedEnabled);
        userAccountRepository.save(user);
    }

    private UserAccount findUser(String email) {
        return userAccountRepository.findByGoogleEmail(email)
                .or(() -> userAccountRepository.findByParticipantNameIgnoreCase(email))
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
    }

    private static String validEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank() || endpoint.length() > MAX_ENDPOINT_LENGTH) {
            throw BusinessException.badRequest("Suscripción push no válida.");
        }
        try {
            URI uri = URI.create(endpoint.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !isKnownPushService(uri.getHost())) {
                throw BusinessException.badRequest("Suscripción push no válida.");
            }
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("Suscripción push no válida.");
        }
        return endpoint.trim();
    }

    /**
     * El servidor hace POST a esta URL: solo se aceptan los servicios push de los navegadores para que
     * nadie pueda usarlo contra otras direcciones.
     */
    static boolean isKnownPushService(String host) {
        if (host == null) return false;
        String h = host.toLowerCase(java.util.Locale.ROOT);
        return PUSH_SERVICE_DOMAINS.stream().anyMatch(domain -> h.equals(domain) || h.endsWith("." + domain));
    }

    private static final java.util.List<String> PUSH_SERVICE_DOMAINS = java.util.List.of(
            "fcm.googleapis.com", "android.googleapis.com", // Chrome, Android, Opera, Samsung Internet
            "push.apple.com",                               // Safari en iOS y macOS
            "push.services.mozilla.com",                    // Firefox
            "notify.windows.com");                          // Edge

    private static String validKey(String key) {
        if (key == null || key.isBlank() || key.length() > MAX_KEY_LENGTH) {
            throw BusinessException.badRequest("Suscripción push no válida.");
        }
        try {
            WebPushSender.b64(key);
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("Suscripción push no válida.");
        }
        return key.trim();
    }
}
