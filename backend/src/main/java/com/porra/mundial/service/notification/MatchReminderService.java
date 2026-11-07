package com.porra.mundial.service.notification;

import com.porra.mundial.service.prediction.MatchSelectionService;
import com.porra.mundial.service.prediction.MatchdayLock;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchReminderSent;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchReminderSentRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Avisa por push, una hora antes de que cierre un partido, a quien aún no lo ha predicho en una liga
 * por jornadas (o un Gran Premio, que cierra al empezar la clasificación, en una liga de Fórmula 1). Agrupa en un solo aviso todos los partidos pendientes del usuario y no repite el aviso
 * de un mismo partido.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchReminderService {

    static final Duration LEAD = Duration.ofHours(1);
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("HH:mm").withZone(AppTime.ZONE);

    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final MembershipRepository membershipRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MatchReminderSentRepository reminderRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;
    private final MatchSelectionService matchSelectionService;

    /** Un partido que el usuario aún no ha predicho en una liga y que cierra pronto. */
    record Pending(Long userId, League league, Match match, Instant lockAt, boolean grandPrix) {
        Pending(Long userId, League league, Match match, Instant lockAt) {
            this(userId, league, match, lockAt, false);
        }
    }

    @Scheduled(initialDelay = 90_000, fixedDelay = 300_000)
    @SchedulerLock(name = "matchReminders", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void sendDueReminders() {
        if (!sender.isEnabled()) return;
        try {
            int sent = sendReminders(Instant.now());
            if (sent > 0) log.info("Recordatorios de predicción enviados a {} usuarios", sent);
        } catch (RuntimeException e) {
            log.error("Fallo al enviar recordatorios de predicción", e);
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
            // Si no llegó a ningún dispositivo se reintenta en la siguiente pasada, mientras siga abierto.
            if (any) {
                delivered++;
                notificationLog.record(entry.getKey(), message, now);
                reminderRepository.saveAll(pending.stream()
                        .map(p -> new MatchReminderSent(new MatchReminderSent.Key(p.userId(), p.match().getId()), now))
                        .collect(Collectors.toMap(r -> r.getId(), r -> r, (a, b) -> a))
                        .values());
            }
        }
        return delivered;
    }

    /** Partidos que cierran en la próxima hora sin predicción, por usuario con avisos activados. */
    List<Pending> findPending(Instant now) {
        Instant horizon = now.plus(LEAD);
        Map<Long, List<Match>> calendars = new HashMap<>();
        List<Pending> pending = new ArrayList<>();

        List<Edition> editions = new ArrayList<>(editionRepository.findActiveByPoolFormat(PoolFormat.MATCH_DAY));
        editions.addAll(editionRepository.findActiveByPoolFormat(PoolFormat.GRAND_PRIX));
        for (Edition edition : editions) {
            League league = edition.getLeague();
            if (league == null) continue;
            if (edition.getCompetition() == null || edition.isLocked()) continue;

            List<Match> candidates;
            List<Match> calendar;
            if (MatchdayLock.needsWholeCalendar(edition)) {
                // Con cierre por día o por jornada, un partido lejano puede cerrar con el primero de su grupo.
                calendar = MatchSelectionService.leagueCalendar(matchSelectionService, edition,
                        id -> calendars.computeIfAbsent(id, matchRepository::findByCompetitionId));
                candidates = calendar.stream()
                        .filter(m -> m.getMatchDate() != null && m.getMatchDate().isAfter(now)
                                && !Boolean.TRUE.equals(m.getFinished()))
                        .toList();
            } else {
                int offset = Math.max(0, edition.getLockOffsetMinutes());
                Instant until = horizon.plus(offset, ChronoUnit.MINUTES);
                candidates = MatchSelectionService.competitionIds(matchSelectionService, edition).stream()
                        .flatMap(id -> matchRepository.findUnfinishedStartingBetween(id, now, until).stream())
                        .toList();
                calendar = candidates;
            }
            Map<Long, Instant> locks = MatchdayLock.lockTimes(edition, candidates, calendar);
            List<Match> due = candidates.stream()
                    .filter(m -> isPredictable(m) && locks.containsKey(m.getId()))
                    .filter(m -> locks.get(m.getId()).isAfter(now) && !locks.get(m.getId()).isAfter(horizon))
                    .toList();
            // Solo se avisa de los partidos que entran en la liga.
            if (!due.isEmpty() && MatchSelectionService.selects(edition)) {
                due = matchSelectionService.filter(edition, due);
            }
            if (due.isEmpty()) continue;

            List<UserAccount> members = membershipRepository.findByLeagueId(league.getId()).stream()
                    .map(Membership::getUser)
                    .filter(user -> user != null && user.isMatchRemindersEnabled())
                    .toList();
            if (members.isEmpty()) continue;

            List<Long> dueIds = due.stream().map(Match::getId).toList();
            Set<String> predicted = new HashSet<>();
            for (Object[] row : matchPredictionRepository.findPredictedUserMatchPairs(edition.getId(), dueIds)) {
                predicted.add(row[0] + ":" + row[1]);
            }
            Set<MatchReminderSent.Key> alreadySent = new HashSet<>(reminderRepository.findKeysByMatchIdIn(dueIds));
            for (UserAccount user : members) {
                for (Match match : due) {
                    if (predicted.contains(user.getId() + ":" + match.getId())) continue;
                    if (alreadySent.contains(new MatchReminderSent.Key(user.getId(), match.getId()))) continue;
                    pending.add(new Pending(user.getId(), league, match, locks.get(match.getId()),
                            PoolFormat.isRaceBased(edition.getPoolFormat())));
                }
            }
        }
        return pending;
    }

    private static boolean isPredictable(Match match) {
        if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) return false;
        return !(match.getHomeTeam() != null && match.getAwayTeam() != null
                && Team.isPlaceholder(match.getHomeTeam()) && Team.isPlaceholder(match.getAwayTeam()));
    }

    /** Aviso con título, texto y la jornada a la que lleva al pulsarlo. */
    PushMessage message(List<Pending> pending, Instant firstLock) {
        Map<Long, League> leagues = new LinkedHashMap<>();
        Set<Long> matches = new HashSet<>();
        for (Pending p : pending) {
            leagues.putIfAbsent(p.league().getId(), p.league());
            matches.add(p.match().getId());
        }
        League first = pending.stream().min(Comparator.comparing(Pending::lockAt)).orElseThrow().league();
        String title;
        String body;
        if (pending.size() == 1) {
            Match match = pending.get(0).match();
            title = pending.get(0).grandPrix() && match.getRound() != null
                    ? "Te falta predecir el " + match.getRound()
                    : "Te falta predecir " + teamName(match.getHomeTeam()) + " – " + teamName(match.getAwayTeam());
            body = first.getName() + " · cierra a las " + HOUR.format(firstLock);
        } else {
            title = "Te faltan " + pending.size() + " predicciones";
            String where = leagues.size() == 1 ? first.getName() : "En " + leagues.size() + " ligas";
            body = where + " · " + (matches.size() == 1 ? "cierra" : "la primera cierra") + " a las "
                    + HOUR.format(firstLock);
        }
        return new PushMessage(title, body, "/jornadas?group=" + first.getId(), "prediction-reminder");
    }

    private static String teamName(Team team) {
        return team == null || team.getName() == null ? "Por definir" : team.getName();
    }
}
