package com.porra.mundial.service.notification;

import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Avisa por push de que una pelea predicha se ha caído de la cartelera o ha cambiado de rival y su predicción
 * ya no cuenta. Va con los recordatorios de predicción: quien los tiene apagados no lo recibe.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FightCardNotifier {

    /** Un cambio de cartelera interesa hasta la velada; un día basta. */
    static final int TTL_SECONDS = 24 * 60 * 60;

    private final UserAccountRepository userAccountRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCardChanged(FightCardChangedEvent event) {
        try {
            int sent = notify(event.notices());
            if (sent > 0) log.info("Aviso de cambio de cartelera enviado a {} usuarios", sent);
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar del cambio de cartelera: {}", e.getMessage());
        }
    }

    /** @return usuarios a los que ha llegado el aviso en al menos un dispositivo */
    int notify(List<FightCardChangedEvent.Notice> notices) {
        if (!sender.isEnabled() || notices == null || notices.isEmpty()) return 0;
        Map<Long, List<FightCardChangedEvent.Notice>> byUser = notices.stream()
                .collect(Collectors.groupingBy(FightCardChangedEvent.Notice::userId, LinkedHashMap::new, Collectors.toList()));
        Set<Long> recipients = userAccountRepository.findAllById(byUser.keySet()).stream()
                .filter(UserAccount::isMatchRemindersEnabled)
                .map(UserAccount::getId)
                .collect(Collectors.toSet());
        if (recipients.isEmpty()) return 0;
        Map<Long, List<PushSubscription>> devices = subscriptionRepository.findByUserIdIn(recipients).stream()
                .collect(Collectors.groupingBy(device -> device.getUser().getId()));
        int delivered = 0;
        Instant now = Instant.now();
        for (Long userId : recipients) {
            PushMessage message = message(byUser.get(userId));
            String payload = message.toJson(objectMapper);
            boolean any = false;
            for (PushSubscription device : devices.getOrDefault(userId, List.of())) {
                WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                        payload, TTL_SECONDS);
                if (result == WebPushSender.Result.SENT) any = true;
                if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
            }
            if (any) {
                delivered++;
                notificationLog.record(userId, message, now);
            }
        }
        return delivered;
    }

    static PushMessage message(List<FightCardChangedEvent.Notice> notices) {
        FightCardChangedEvent.Notice first = notices.get(0);
        String url = "/jornadas?group=" + first.leagueId();
        if (notices.size() == 1) {
            return new PushMessage(first.title(), first.body(), url, "fight-card-" + first.leagueId());
        }
        long leagues = notices.stream().map(FightCardChangedEvent.Notice::leagueId).distinct().count();
        String where = leagues == 1 ? first.leagueName() : "En " + leagues + " ligas";
        return new PushMessage("Cambios en la cartelera",
                where + ": " + notices.size() + " predicciones anuladas por peleas canceladas o con nuevo rival. Vuelve a predecir.",
                url, "fight-card");
    }
}
