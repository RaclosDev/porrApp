package app.porrapp.service.admin;

import app.porrapp.model.Match;
import app.porrapp.model.MatchSyncIncident;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.Team;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MatchSyncIncidentRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.service.notification.MatchSyncIncidentOpenedEvent;
import app.porrapp.service.notification.PushMessage;
import app.porrapp.service.notification.PushNotificationLogService;
import app.porrapp.service.notification.WebPushSender;
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Avisa por push al administrador de porrApp (las cuentas de ADMIN_EMAILS, no los administradores de cada
 * liga) de que la sincronización ha retenido un resultado y tiene que revisarlo en el panel.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminIncidentNotifier {

    /** Ruta del panel con la sección de incidencias abierta. */
    static final String PANEL_URL = "/gestion-7k2q?seccion=incidencias";
    static final int TTL_SECONDS = 24 * 60 * 60;

    private final AdminAccess access;
    private final MatchSyncIncidentRepository incidents;
    private final MatchRepository matchRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onIncidentOpened(MatchSyncIncidentOpenedEvent event) {
        try {
            int sent = notify(event.incidentId());
            if (sent > 0) log.info("Aviso de incidencia de resultado enviado a {} administradores", sent);
        } catch (RuntimeException e) {
            log.warn("No se pudo avisar de la incidencia de resultado: {}", e.getMessage());
        }
    }

    /** @return administradores a los que ha llegado el aviso en al menos un dispositivo */
    int notify(Long incidentId) {
        if (!sender.isEnabled()) return 0;
        MatchSyncIncident incident = incidents.findById(incidentId).orElse(null);
        if (incident == null || !incident.isOpen()) return 0;
        List<Long> admins = access.adminUserIds();
        if (admins.isEmpty()) return 0;
        Match match = matchRepository.findById(incident.getMatchId()).orElse(null);
        PushMessage message = message(incident, match);
        String payload = message.toJson(objectMapper);
        Instant now = Instant.now();
        Set<Long> reached = new HashSet<>();
        Set<Long> queued = new HashSet<>();
        for (PushSubscription device : subscriptionRepository.findByUserIdIn(admins)) {
            Long userId = device.getUser().getId();
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    payload, TTL_SECONDS, userId);
            if (result == WebPushSender.Result.SENT) reached.add(userId);
            if (result == WebPushSender.Result.QUEUED) queued.add(userId);
            if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
        }
        reached.forEach(userId -> notificationLog.record(userId, message, now));
        queued.addAll(reached);
        return queued.size();
    }

    static PushMessage message(MatchSyncIncident incident, Match match) {
        String teams = match == null ? "Un partido"
                : name(match.getHomeTeam()) + " - " + name(match.getAwayTeam());
        String stored = score(incident.getPreviousHomeScore(), incident.getPreviousAwayScore());
        String body = switch (incident.getKind()) {
            case SCORE_CHANGE -> teams + ": el proveedor da " + score(incident.getReceivedHomeScore(),
                    incident.getReceivedAwayScore()) + " en vez de " + stored
                    + ". Se aplicará si lo confirma; revísalo en el panel.";
            case REGRESSION -> teams + ": ya terminado " + stored + ", el proveedor lo devuelve como "
                    + AdminIncidentService.statusLabel(incident.getReceivedStatus())
                    + ". Se mantiene el resultado; revísalo en el panel.";
            case FIGHT_MISSING -> teams + ": ya no sale en la cartelera. Revísalo en el panel.";
        };
        return new PushMessage("Resultado retenido", body, PANEL_URL, "admin-incidents");
    }

    private static String score(Integer home, Integer away) {
        return (home == null ? "–" : home) + "-" + (away == null ? "–" : away);
    }

    private static String name(Team team) {
        return team == null || team.getName() == null ? Team.PLACEHOLDER_NAME : team.getName();
    }
}
