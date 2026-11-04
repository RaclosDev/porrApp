package com.porra.mundial.service;

import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
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
        if (league == null || league.isGlobal() || League.isGlobalId(league.getId())) return 0;
        UserAccount joined = userAccountRepository.findById(event.userId()).orElse(null);
        if (joined == null) return 0;

        List<Membership> memberships = membershipRepository.findByLeagueId(league.getId());
        Set<Long> recipients = memberships.stream()
                .map(Membership::getUser)
                .filter(user -> user != null && !user.getId().equals(joined.getId()) && user.isMemberJoinedAlertsEnabled())
                .map(UserAccount::getId)
                .collect(Collectors.toSet());
        if (recipients.isEmpty()) return 0;

        String payload = payload(league, joined, memberships.size());
        Map<Long, Boolean> delivered = new LinkedHashMap<>();
        for (PushSubscription device : subscriptionRepository.findByUserIdIn(recipients)) {
            Long userId = device.getUser().getId();
            if (!recipients.contains(userId)) continue;
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    payload, TTL_SECONDS);
            if (result == WebPushSender.Result.SENT) delivered.put(userId, true);
            if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
        }
        return delivered.size();
    }

    String payload(League league, UserAccount joined, int memberCount) {
        String name = joined.getParticipantName() == null || joined.getParticipantName().isBlank()
                ? "Un nuevo participante" : joined.getParticipantName().trim();
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("title", name + " se ha unido a " + league.getName());
        message.put("body", "Ya sois " + memberCount + " en la liga.");
        // /jornadas cambia a la liga de ?group= y, si no es por jornadas, lleva a su inicio.
        message.put("url", "/jornadas?group=" + league.getId());
        message.put("tag", "member-joined-" + league.getId());
        return objectMapper.writeValueAsString(message);
    }
}
