package app.porrapp.service.formulaone;

import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.RaceDriver;
import app.porrapp.model.RaceWeekend;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.service.notification.PushMessage;
import app.porrapp.service.notification.PushNotificationLogService;
import app.porrapp.service.notification.WebPushSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Aviso push del resultado de un Gran Premio a los miembros de las ligas de Fórmula 1 con los avisos de
 * resultados activados: el podio y, si lo predijeron, los puntos que han sumado. Uno por usuario.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GrandPrixResultNotifier {

    static final int TTL_SECONDS = 12 * 60 * 60;

    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final RaceDriverRepository raceDriverRepository;
    private final WebPushSender sender;
    private final PushNotificationLogService notificationLog;
    private final ObjectMapper objectMapper;

    /** Puntos de un usuario en una liga en este Gran Premio; null si no lo predijo. */
    record Recipient(Long userId, League league, Integer points) {}

    /** @return usuarios a los que ha llegado el aviso */
    @Transactional
    public int notifyResult(Match match, RaceWeekend weekend) {
        if (!sender.isEnabled() || match == null || match.getCompetition() == null || weekend == null || !weekend.hasPodium()) {
            return 0;
        }
        Map<Long, Recipient> recipients = recipients(match);
        if (recipients.isEmpty()) return 0;

        String podium = podium(weekend);
        Map<Long, Boolean> delivered = new LinkedHashMap<>();
        Instant now = Instant.now();
        Map<Long, PushMessage> messages = new HashMap<>();
        for (PushSubscription device : subscriptionRepository.findByUserIdIn(recipients.keySet())) {
            Long userId = device.getUser().getId();
            Recipient recipient = recipients.get(userId);
            if (recipient == null) continue;
            PushMessage message = messages.computeIfAbsent(userId, id -> message(match, recipient, podium));
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    message.toJson(objectMapper), TTL_SECONDS, device.getUser().getId());
            if (result == WebPushSender.Result.SENT) delivered.put(userId, true);
            if (result == WebPushSender.Result.FAILED) throw new IllegalStateException("No se pudo conservar el resultado de F1");
            if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
        }
        delivered.keySet().forEach(userId -> notificationLog.record(userId, messages.get(userId), now));
        if (!delivered.isEmpty()) log.info("Resultado de {} avisado a {} usuarios", match.getRound(), delivered.size());
        return delivered.size();
    }

    /** Un destinatario por usuario: la liga en la que predijo (o la primera, si no predijo en ninguna). */
    Map<Long, Recipient> recipients(Match match) {
        Map<Long, Recipient> recipients = new LinkedHashMap<>();
        Map<String, Integer> points = new HashMap<>();
        for (MatchPrediction pick : matchPredictionRepository.findByMatchId(match.getId())) {
            if (pick.getPrediction() == null || pick.getPrediction().getUser() == null
                    || pick.getPrediction().getEdition() == null || pick.getPrediction().getEdition().getLeague() == null) continue;
            points.put(pick.getPrediction().getUser().getId() + ":" + pick.getPrediction().getEdition().getLeague().getId(),
                    pick.getPointsAwarded() == null ? 0 : pick.getPointsAwarded());
        }
        for (Edition edition : editionRepository.findActiveByPoolFormat(PoolFormat.GRAND_PRIX)) {
            if (edition.getCompetition() == null
                    || !Objects.equals(edition.getCompetition().getId(), match.getCompetition().getId())) continue;
            League league = edition.getLeague();
            for (Membership membership : membershipRepository.findByLeagueId(league.getId())) {
                UserAccount user = membership.getUser();
                if (user == null || user.getId() == null || !user.isMatchdayFinishedAlertsEnabled()) continue;
                Integer userPoints = points.get(user.getId() + ":" + league.getId());
                Recipient current = recipients.get(user.getId());
                if (current == null || (current.points() == null && userPoints != null)) {
                    recipients.put(user.getId(), new Recipient(user.getId(), league, userPoints));
                }
            }
        }
        return recipients;
    }

    PushMessage message(Match match, Recipient recipient, String podium) {
        String title = recipient.points() == null
                ? "Resultado del " + match.getRound()
                : match.getRound() + ": " + recipient.points() + (recipient.points() == 1 ? " punto" : " puntos");
        String body = (recipient.points() == null ? "" : recipient.league().getName() + " · ") + podium;
        return new PushMessage(title, body, "/jornadas?group=" + recipient.league().getId(),
                "gp-result-" + match.getId());
    }

    private String podium(RaceWeekend weekend) {
        Map<Long, RaceDriver> drivers = raceDriverRepository.findAllById(
                        List.of(weekend.getFirstDriverId(), weekend.getSecondDriverId(), weekend.getThirdDriverId()))
                .stream().collect(Collectors.toMap(RaceDriver::getId, d -> d));
        return "Podio: " + name(drivers.get(weekend.getFirstDriverId())) + ", "
                + name(drivers.get(weekend.getSecondDriverId())) + " y " + name(drivers.get(weekend.getThirdDriverId()));
    }

    private static String name(RaceDriver driver) {
        if (driver == null) return "?";
        return driver.getShortName() != null ? driver.getShortName() : driver.getName();
    }
}
