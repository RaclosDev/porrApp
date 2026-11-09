package app.porrapp.service.notification;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchReminderSent;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.Team;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchReminderSentRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.service.prediction.DrawnKnockout;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Avisa por push, una hora antes de que cierre una serie de los playoffs de la NBA, a quien aún no ha
 * elegido quién la gana en su liga. Es el equivalente del aviso de partidos de las ligas por jornadas:
 * agrupa en un solo aviso todo lo pendiente del usuario y no repite el aviso de una misma serie (se guarda
 * con el primer partido de la serie).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeriesReminderService {

    static final Duration LEAD = MatchReminderService.LEAD;
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("HH:mm").withZone(AppTime.ZONE);

    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;
    private final MatchReminderSentRepository reminderRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;

    /** Una serie que el usuario aún no ha pronosticado en una liga y que cierra pronto. */
    record Pending(Long userId, League league, DrawnKnockout.Tie tie, Instant lockAt) {
        Match firstGame() {
            return tie.legs().get(0);
        }
    }

    @Scheduled(initialDelay = 120_000, fixedDelay = 300_000)
    @SchedulerLock(name = "seriesReminders", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void sendDueReminders() {
        if (!sender.isEnabled()) return;
        try {
            int sent = sendReminders(Instant.now());
            if (sent > 0) log.info("Recordatorios de series de la NBA enviados a {} usuarios", sent);
        } catch (RuntimeException e) {
            log.error("Fallo al enviar recordatorios de series de la NBA", e);
        }
    }

    /** @return usuarios a los que se ha entregado al menos un aviso */
    int sendReminders(Instant now) {
        Map<Long, List<Pending>> byUser = findPending(now).stream()
                .collect(Collectors.groupingBy(Pending::userId, LinkedHashMap::new, Collectors.toList()));
        if (byUser.isEmpty()) return 0;

        Map<Long, List<PushSubscription>> devices = subscriptionRepository.findByUserIdIn(byUser.keySet()).stream()
                .collect(Collectors.groupingBy(subscription -> subscription.getUser().getId()));
        int delivered = 0;
        for (Map.Entry<Long, List<Pending>> entry : byUser.entrySet()) {
            List<PushSubscription> userDevices = devices.getOrDefault(entry.getKey(), List.of());
            if (userDevices.isEmpty()) continue;
            List<Pending> pending = entry.getValue();
            Instant firstLock = pending.stream().map(Pending::lockAt).min(Comparator.naturalOrder()).orElseThrow();
            int ttl = (int) Math.max(60, Duration.between(now, firstLock).toSeconds());
            PushMessage message = message(pending, firstLock);
            String payload = message.toJson(objectMapper);

            boolean any = false;
            for (PushSubscription device : userDevices) {
                WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                        payload, ttl);
                if (result == WebPushSender.Result.SENT) any = true;
                if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
            }
            // Si no llegó a ningún dispositivo se reintenta en la siguiente pasada, mientras siga abierta.
            if (any) {
                delivered++;
                notificationLog.record(entry.getKey(), message, now);
                reminderRepository.saveAll(pending.stream()
                        .map(p -> new MatchReminderSent(new MatchReminderSent.Key(p.userId(), p.firstGame().getId()), now))
                        .collect(Collectors.toMap(MatchReminderSent::getId, r -> r, (a, b) -> a))
                        .values());
            }
        }
        return delivered;
    }

    /** Series que cierran en la próxima hora sin elección, por usuario con avisos activados. */
    List<Pending> findPending(Instant now) {
        Instant horizon = now.plus(LEAD);
        Map<Long, List<Match>> calendars = new HashMap<>();
        List<Pending> pending = new ArrayList<>();

        for (Edition edition : editionRepository.findActiveByPoolFormat(PoolFormat.KNOCKOUTS_ONLY)) {
            League league = edition.getLeague();
            if (league == null || !DrawnKnockout.playsSeries(edition) || edition.isLocked()) continue;
            List<Match> calendar = calendars.computeIfAbsent(edition.getCompetition().getId(),
                    matchRepository::findByCompetitionId);
            List<Due> due = dueSeries(edition, DrawnKnockout.rounds(edition, calendar), now, horizon);
            if (due.isEmpty()) continue;

            List<UserAccount> members = membershipRepository.findByLeagueId(league.getId()).stream()
                    .map(Membership::getUser)
                    .filter(user -> user != null && user.isMatchRemindersEnabled())
                    .toList();
            if (members.isEmpty()) continue;

            Map<Long, PredictionDataDTO> picks = new HashMap<>();
            for (Prediction prediction : predictionRepository.findByEditionLeagueId(league.getId())) {
                if (prediction.getUser() != null && Objects.equals(prediction.getEdition().getId(), edition.getId())) {
                    picks.put(prediction.getUser().getId(), prediction.getBracketData());
                }
            }
            Set<MatchReminderSent.Key> alreadySent = new HashSet<>(reminderRepository.findKeysByMatchIdIn(
                    due.stream().map(item -> item.tie().legs().get(0).getId()).toList()));
            for (UserAccount user : members) {
                for (Due item : due) {
                    if (picked(picks.get(user.getId()), item.round(), item.index())) continue;
                    Long firstGame = item.tie().legs().get(0).getId();
                    if (alreadySent.contains(new MatchReminderSent.Key(user.getId(), firstGame))) continue;
                    pending.add(new Pending(user.getId(), league, item.tie(), item.lockAt()));
                }
            }
        }
        return pending;
    }

    /** Serie que cierra antes del horizonte, con su posición en el pronóstico. */
    record Due(int round, int index, DrawnKnockout.Tie tie, Instant lockAt) {}

    /**
     * Series con sus dos equipos que aún no han cerrado y cierran antes de {@code horizon}: cada una al
     * empezar su primer partido o, con cierre por rondas, todas al empezar la primera de su ronda.
     */
    static List<Due> dueSeries(Edition edition, List<DrawnKnockout.Round> rounds, Instant now, Instant horizon) {
        Duration offset = Duration.ofMinutes(Math.max(0, edition.getLockOffsetMinutes()));
        boolean perRound = edition.getLockMode() == PredictionLockMode.PER_ROUND;
        List<Due> due = new ArrayList<>();
        for (int round = 0; round < rounds.size(); round++) {
            DrawnKnockout.Round item = rounds.get(round);
            if (!item.drawn()) continue;
            Instant roundStart = item.ties().stream().map(DrawnKnockout.Tie::start).filter(Objects::nonNull)
                    .min(Comparator.naturalOrder()).orElse(null);
            for (int index = 0; index < item.ties().size(); index++) {
                DrawnKnockout.Tie tie = item.ties().get(index);
                Instant start = perRound ? roundStart : tie.start();
                if (!tie.drawn() || tie.winner() != null || start == null) continue;
                Instant lockAt = start.minus(offset);
                if (lockAt.isAfter(now) && !lockAt.isAfter(horizon)) due.add(new Due(round, index, tie, lockAt));
            }
        }
        return due;
    }

    private static boolean picked(PredictionDataDTO data, int round, int index) {
        if (data == null || data.getCustomRounds() == null || round >= data.getCustomRounds().size()) return false;
        List<String> row = data.getCustomRounds().get(round);
        return row != null && index < row.size() && row.get(index) != null;
    }

    /** Aviso con título, texto y la predicción a la que lleva al pulsarlo. */
    PushMessage message(List<Pending> pending, Instant firstLock) {
        Map<Long, League> leagues = new LinkedHashMap<>();
        for (Pending p : pending) leagues.putIfAbsent(p.league().getId(), p.league());
        League first = pending.stream().min(Comparator.comparing(Pending::lockAt)).orElseThrow().league();
        String title;
        String body;
        if (pending.size() == 1) {
            DrawnKnockout.Tie tie = pending.get(0).tie();
            title = "Te falta predecir " + teamName(tie.home()) + " – " + teamName(tie.away());
            body = first.getName() + " · cierra a las " + HOUR.format(firstLock);
        } else {
            title = "Te faltan " + pending.size() + " series por predecir";
            String where = leagues.size() == 1 ? first.getName() : "En " + leagues.size() + " ligas";
            body = where + " · la primera cierra a las " + HOUR.format(firstLock);
        }
        return new PushMessage(title, body, "/prediction?group=" + first.getId(), "prediction-reminder");
    }

    private static String teamName(Team team) {
        return team == null || team.getName() == null ? "Por definir" : team.getName();
    }
}
