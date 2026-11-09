package com.porra.mundial.service.notification;

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
import java.util.List;
import java.util.Optional;

/** Dispositivos suscritos a avisos push y preferencias de avisos de cada usuario. */
@Service
@RequiredArgsConstructor
public class PushSubscriptionService {

    private static final int MAX_ENDPOINT_LENGTH = 2048;
    private static final int MAX_KEY_LENGTH = 255;
    static final int MAX_SUBSCRIPTIONS_PER_USER = 10;

    private final PushSubscriptionRepository subscriptionRepository;
    private final UserAccountRepository userAccountRepository;
    private final WebPushSender sender;

    @Transactional(readOnly = true)
    public PushConfigResponse config(String email) {
        UserAccount user = findUser(email);
        return new PushConfigResponse(sender.publicKey(), user.isMatchRemindersEnabled(),
                user.isMemberJoinedAlertsEnabled(), user.isMatchdayFinishedAlertsEnabled());
    }

    /**
     * Guarda el dispositivo; si ya estaba con otra cuenta (cambio de sesión en el mismo navegador,
     * con las mismas claves), pasa a esta. Cada usuario conserva como mucho
     * {@link #MAX_SUBSCRIPTIONS_PER_USER} dispositivos.
     */
    @Transactional
    public void subscribe(String email, PushSubscriptionRequest request) {
        String endpoint = validEndpoint(request.endpoint());
        String p256dh = validKey(request.p256dh());
        String auth = validKey(request.auth());
        UserAccount user = findUser(email);
        Optional<PushSubscription> existing = subscriptionRepository.findByEndpoint(endpoint);
        if (existing.isPresent()) {
            PushSubscription subscription = existing.get();
            // El mismo navegador vuelve a mandar las mismas claves. Con otras, quien envía el
            // endpoint no es ese navegador: no se le pasan los avisos de otra cuenta.
            boolean sameBrowser = subscription.getP256dh().equals(p256dh) && subscription.getAuth().equals(auth);
            if (!sameBrowser && !subscription.getUser().getId().equals(user.getId())) {
                throw BusinessException.conflict("Este dispositivo ya está suscrito con otra cuenta.");
            }
            subscription.setUser(user);
            subscription.setP256dh(p256dh);
            subscription.setAuth(auth);
            subscriptionRepository.save(subscription);
            return;
        }
        // Un usuario no necesita más que unos pocos dispositivos: se descartan los más antiguos.
        List<PushSubscription> current = subscriptionRepository.findByUserIdOrderByCreatedAtAsc(user.getId());
        int excess = current.size() - (MAX_SUBSCRIPTIONS_PER_USER - 1);
        if (excess > 0) {
            subscriptionRepository.deleteAll(current.subList(0, excess));
        }
        subscriptionRepository.save(PushSubscription.builder()
                .endpoint(endpoint)
                .user(user)
                .p256dh(p256dh)
                .auth(auth)
                .build());
    }

    @Transactional
    public void unsubscribe(String email, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) return;
        subscriptionRepository.deleteByEndpointAndUserId(endpoint.trim(), findUser(email).getId());
    }

    @Transactional
    public void setPreferences(String email, Boolean remindersEnabled, Boolean memberJoinedEnabled,
                               Boolean matchdayFinishedEnabled) {
        UserAccount user = findUser(email);
        if (remindersEnabled != null) user.setMatchRemindersEnabled(remindersEnabled);
        if (memberJoinedEnabled != null) user.setMemberJoinedAlertsEnabled(memberJoinedEnabled);
        if (matchdayFinishedEnabled != null) user.setMatchdayFinishedAlertsEnabled(matchdayFinishedEnabled);
        userAccountRepository.save(user);
    }

    private UserAccount findUser(String email) {
        return userAccountRepository.findByGoogleEmail(email)
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
