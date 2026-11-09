package app.porrapp.service.league;

import app.porrapp.service.notification.PushMessage;
import app.porrapp.service.notification.PushNotificationLogService;
import app.porrapp.service.notification.WebPushSender;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.repository.UserAccountRepository;
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
 * Avisa por push a los demás miembros de una liga de que se ha unido alguien.
 * <p>
 * Corre fuera de la petición y después de confirmar el alta: un fallo del push no la deshace.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberJoinedNotifier {

    /** Si el dispositivo está apagado más de un día, el aviso ya no interesa. */
    static final int TTL_SECONDS = 24 * 60 * 60;

    private final LeagueRepository leagueRepository;
    private final UserAccountRepository userAccountRepository;
    private final MembershipRepository membershipRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onMemberJoined(MemberJoinedLeagueEvent event) {
        try {
            int sent = notifyMembers(event);
            if (sent > 0) log.info("Aviso de nuevo miembro de la liga {} enviado a {} usuarios", event.leagueId(), sent);
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar del nuevo miembro de la liga {}: {}", event.leagueId(), e.getMessage());
        }
    }

    /** @return usuarios a los que ha llegado el aviso en al menos un dispositivo */
    int notifyMembers(MemberJoinedLeagueEvent event) {
        if (!sender.isEnabled()) return 0;
        League league = leagueRepository.findById(event.leagueId()).orElse(null);
        // En una liga pública entra cualquiera: avisar de cada alta sería ruido.
        if (league == null || league.isPublicLeague()) return 0;
        UserAccount joined = userAccountRepository.findById(event.userId()).orElse(null);
        if (joined == null) return 0;

        List<Membership> memberships = membershipRepository.findByLeagueId(league.getId());
        Set<Long> recipients = memberships.stream()
                .map(Membership::getUser)
                .filter(user -> user != null && !user.getId().equals(joined.getId()) && user.isMemberJoinedAlertsEnabled())
                .map(UserAccount::getId)
                .collect(Collectors.toSet());
        if (recipients.isEmpty()) return 0;

        PushMessage message = message(league, joined, memberships.size());
        String payload = message.toJson(objectMapper);
        Map<Long, Boolean> delivered = new LinkedHashMap<>();
        for (PushSubscription device : subscriptionRepository.findByUserIdIn(recipients)) {
            Long userId = device.getUser().getId();
            if (!recipients.contains(userId)) continue;
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    payload, TTL_SECONDS);
            if (result == WebPushSender.Result.SENT) delivered.put(userId, true);
            if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
        }
        Instant now = Instant.now();
        delivered.keySet().forEach(userId -> notificationLog.record(userId, message, now));
        return delivered.size();
    }

    private PushMessage message(League league, UserAccount joined, int memberCount) {
        String name = joined.getParticipantName() == null || joined.getParticipantName().isBlank()
                ? "Un nuevo participante" : joined.getParticipantName().trim();
        // El título se corta en una línea en la pantalla de bloqueo: quién y a qué liga van en el cuerpo,
        // que se ve entero. Lleva al inicio de esa liga (el inicio cambia a la liga de ?group=).
        return new PushMessage("Nuevo miembro en tu liga",
                name + " se ha unido a " + league.getName() + ". Ya sois " + memberCount + ".",
                "/?group=" + league.getId(), "member-joined-" + league.getId());
    }
}
