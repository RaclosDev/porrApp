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
 * Envía avisos de la liga por push fuera de la petición y después de confirmar el cambio.
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
    public void onPokerNotification(PokerNotificationEvent event) {
        try {
            if (!sender.isEnabled()) return;
            int ttl = (int) Math.min(TTL_SECONDS, (event.expiresAt() - System.currentTimeMillis()) / 1000);
            if (ttl <= 0) return;
            Set<Long> recipients = userAccountRepository.findAllById(event.recipients()).stream()
                    .filter(user -> user.isMatchRemindersEnabled() || user.isMemberJoinedAlertsEnabled()
                            || user.isMatchdayFinishedAlertsEnabled())
                    .map(UserAccount::getId).collect(Collectors.toSet());
            if (!recipients.isEmpty()) deliver(recipients, event.message(), ttl);
        } catch (RuntimeException e) {
            log.warn("No se pudo enviar el aviso de póker: {}", e.getMessage());
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAdminGranted(LeagueAdminGrantedEvent event) {
        try {
            if (!sender.isEnabled()) return;
            Membership target = membershipRepository.findById(new Membership.MembershipId(event.userId(), event.leagueId()))
                    .orElse(null);
            if (target == null || !"ADMIN".equals(target.getRole())) return;
            UserAccount user = target.getUser();
            if (!user.isMatchRemindersEnabled() && !user.isMemberJoinedAlertsEnabled()
                    && !user.isMatchdayFinishedAlertsEnabled()) return;

            League league = target.getLeague();
            String url = league.isTournament() ? "/torneos/" + league.getId() : "/?group=" + league.getId();
            deliver(Set.of(event.userId()), new PushMessage("Permisos de administrador",
                    "Ahora puedes administrar «" + league.getName() + "».", url, "league-admin-granted-" + league.getId()));
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar del nombramiento de administrador de la liga {}: {}",
                    event.leagueId(), e.getMessage());
        }
    }

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

        return deliver(recipients, message(league, joined, memberships.size()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onLeagueRepeated(LeagueRepeatedEvent event) {
        try {
            int sent = notifyRepeated(event);
            if (sent > 0) log.info("Aviso de la liga repetida {} enviado a {} usuarios", event.leagueId(), sent);
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar de la liga repetida {}: {}", event.leagueId(), e.getMessage());
        }
    }

    /**
     * Avisa a quienes han entrado en la liga de la temporada nueva sin pedirlo: su administrador la ha
     * repetido y ya la tienen entre sus ligas.
     *
     * @return usuarios a los que ha llegado el aviso en al menos un dispositivo
     */
    int notifyRepeated(LeagueRepeatedEvent event) {
        if (!sender.isEnabled()) return 0;
        League league = leagueRepository.findById(event.leagueId()).orElse(null);
        if (league == null) return 0;
        Set<Long> recipients = membershipRepository.findByLeagueId(league.getId()).stream()
                .map(Membership::getUser)
                .filter(user -> user != null && !user.getId().equals(event.userId())
                        && user.isMemberJoinedAlertsEnabled())
                .map(UserAccount::getId)
                .collect(Collectors.toSet());
        if (recipients.isEmpty()) return 0;

        String season = event.season() == null || event.season().isBlank() ? "nueva" : event.season().trim();
        return deliver(recipients, new PushMessage("Nueva temporada de tu liga",
                league.getName() + " sigue en la temporada " + season + ". Ya puedes hacer tus predicciones.",
                "/?group=" + league.getId(), "league-repeated-" + league.getId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onDayStarted(ScoreDayStartedEvent event) {
        try {
            int sent = notifyDayStarted(event);
            if (sent > 0) log.info("Aviso de día de juego de la liga {} enviado a {} usuarios", event.leagueId(), sent);
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar del día de juego de la liga {}: {}", event.leagueId(), e.getMessage());
        }
    }

    /**
     * Avisa a los demás miembros de una liga de juegos de mesa de que ha empezado un día de juego, para que
     * sigan la partida desde el móvil.
     *
     * @return usuarios a los que ha llegado el aviso en al menos un dispositivo
     */
    int notifyDayStarted(ScoreDayStartedEvent event) {
        if (!sender.isEnabled()) return 0;
        League league = leagueRepository.findById(event.leagueId()).orElse(null);
        if (league == null) return 0;
        UserAccount starter = userAccountRepository.findById(event.userId()).orElse(null);
        Set<Long> recipients = membershipRepository.findByLeagueId(league.getId()).stream()
                .map(Membership::getUser)
                .filter(user -> user != null && !user.getId().equals(event.userId())
                        && user.isMemberJoinedAlertsEnabled())
                .map(UserAccount::getId)
                .collect(Collectors.toSet());
        if (recipients.isEmpty()) return 0;

        String who = starter == null || starter.getParticipantName() == null || starter.getParticipantName().isBlank()
                ? "Alguien" : starter.getParticipantName().trim();
        return deliver(recipients, new PushMessage("Ha empezado un día de juego",
                who + " ha empezado un día de juego en " + league.getName() + ". Sigue las partidas en directo.",
                "/?group=" + league.getId(), "score-day-" + league.getId()));
    }

    /** @return usuarios a los que ha llegado el aviso en al menos un dispositivo */
    private int deliver(Set<Long> recipients, PushMessage message) {
        return deliver(recipients, message, TTL_SECONDS);
    }

    private int deliver(Set<Long> recipients, PushMessage message, int ttlSeconds) {
        String payload = message.toJson(objectMapper);
        Map<Long, Boolean> delivered = new LinkedHashMap<>();
        for (PushSubscription device : subscriptionRepository.findByUserIdIn(recipients)) {
            Long userId = device.getUser().getId();
            if (!recipients.contains(userId)) continue;
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    payload, ttlSeconds, device.getUser().getId());
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
