package com.porra.mundial.service.notification;

import com.porra.mundial.sports.NflSchedule;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
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
import com.porra.mundial.service.prediction.MatchdayLock;
import com.porra.mundial.service.prediction.SurvivorRules;
import com.porra.mundial.util.AppTime;
import com.porra.mundial.util.MatchRound;
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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Superviviente: avisa por push a quien sigue vivo y aún no ha elegido equipo en una jornada, porque
 * dejarla sin elegir le gasta una vida (o le elimina). El aviso sale cuando falta menos de {@link #LEAD}
 * para que se cierre el primer partido de la jornada (y mientras quede alguno abierto), una vez por jornada, liga y
 * usuario (registro de {@link MatchReminderSent} con tipo {@link MatchReminderSent#survivor}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SurvivorReminderService {

    static final Duration LEAD = Duration.ofHours(24);
    private static final Locale ES = Locale.forLanguageTag("es-ES");
    private static final DateTimeFormatter WEEKDAY_TIME =
            DateTimeFormatter.ofPattern("EEEE HH:mm", ES).withZone(AppTime.ZONE);
    private static final DateTimeFormatter WEEKDAY_DATE_TIME =
            DateTimeFormatter.ofPattern("EEEE d/M HH:mm", ES).withZone(AppTime.ZONE);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEEE d/M", ES).withZone(AppTime.ZONE);

    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final MembershipRepository membershipRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MatchReminderSentRepository reminderRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;

    /**
     * Jornada en la que un miembro aún no ha elegido equipo.
     *
     * @param markerMatchId partido que identifica la jornada en el registro de avisos (el de menor id)
     * @param deadline      cierre del último partido abierto: sin elegir antes, pierde la jornada
     * @param livesLeft     vidas que le quedan (con 1, no elegir le elimina)
     */
    record Pending(Long userId, League league, String round, Long markerMatchId, Instant deadline, int livesLeft) {}

    @Scheduled(initialDelay = 120_000, fixedDelay = 300_000)
    @SchedulerLock(name = "survivorReminders", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void sendDueReminders() {
        if (!sender.isEnabled()) return;
        try {
            int sent = sendReminders(Instant.now());
            if (sent > 0) log.info("Recordatorios de elección de superviviente enviados: {}", sent);
        } catch (RuntimeException e) {
            log.error("Fallo al enviar recordatorios de superviviente", e);
        }
    }

    /** @return avisos entregados (uno por usuario, liga y jornada) */
    int sendReminders(Instant now) {
        List<Pending> pending = findPending(now);
        if (pending.isEmpty()) return 0;

        Set<Long> userIds = pending.stream().map(Pending::userId).collect(Collectors.toSet());
        Map<Long, List<PushSubscription>> devices = subscriptionRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.groupingBy(subscription -> subscription.getUser().getId()));
        int delivered = 0;
        for (Pending p : pending) {
            List<PushSubscription> userDevices = devices.getOrDefault(p.userId(), List.of());
            if (userDevices.isEmpty()) continue;
            PushMessage message = message(p, now);
            String payload = message.toJson(objectMapper);
            int ttl = (int) Math.max(60, Duration.between(now, p.deadline()).toSeconds());

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
                notificationLog.record(p.userId(), message, now);
                reminderRepository.save(new MatchReminderSent(new MatchReminderSent.Key(p.userId(), p.markerMatchId(),
                        MatchReminderSent.survivor(p.league().getId())), now));
            }
        }
        return delivered;
    }

    /** Jornadas a punto de cerrarse sin elección, por miembro vivo con avisos activados. */
    List<Pending> findPending(Instant now) {
        Instant horizon = now.plus(LEAD);
        Map<Long, List<Match>> calendars = new HashMap<>();
        List<Pending> pending = new ArrayList<>();

        for (Edition edition : editionRepository.findActiveByPoolFormat(PoolFormat.SURVIVOR)) {
            League league = edition.getLeague();
            if (league == null || edition.getCompetition() == null || edition.isLocked()) continue;
            List<Match> calendar = calendars.computeIfAbsent(edition.getCompetition().getId(),
                    matchRepository::findByCompetitionId);
            List<Round> rounds = dueRounds(edition, calendar, now, horizon);
            if (rounds.isEmpty()) continue;

            List<Membership> members = membershipRepository.findByLeagueId(league.getId()).stream()
                    .filter(m -> m.getUser() != null && m.getUser().isMatchRemindersEnabled())
                    .toList();
            if (members.isEmpty()) continue;

            Map<Long, List<MatchPrediction>> picksByUser = new HashMap<>();
            for (MatchPrediction pick : matchPredictionRepository.findWithMatchAndUserByEditionId(edition.getId())) {
                UserAccount owner = pick.getPrediction() == null ? null : pick.getPrediction().getUser();
                if (owner != null) picksByUser.computeIfAbsent(owner.getId(), id -> new ArrayList<>()).add(pick);
            }
            String kind = MatchReminderSent.survivor(league.getId());
            Set<MatchReminderSent.Key> alreadySent = new HashSet<>(reminderRepository.findKeysByMatchIdIn(
                    rounds.stream().map(Round::markerMatchId).toList()));
            SurvivorRules.Settings settings = SurvivorRules.Settings.of(edition);

            for (Membership member : members) {
                Long userId = member.getUser().getId();
                List<MatchPrediction> picks = picksByUser.getOrDefault(userId, List.of());
                SurvivorRules.Standing standing =
                        SurvivorRules.standing(picks, calendar, member.getJoinedAt(), now, settings);
                if (standing.eliminated()) continue;
                Set<String> pickedRounds = picks.stream()
                        .filter(pick -> pick.getMatch() != null)
                        .map(pick -> MatchRound.label(pick.getMatch()))
                        .collect(Collectors.toSet());
                for (Round round : rounds) {
                    if (pickedRounds.contains(round.label())) continue;
                    // Una jornada que empezó antes de que entrase en la liga no le cuenta: no hay nada que avisar.
                    if (member.getJoinedAt() == null || round.firstStart().isBefore(member.getJoinedAt())) continue;
                    if (alreadySent.contains(new MatchReminderSent.Key(userId, round.markerMatchId(), kind))) continue;
                    pending.add(new Pending(userId, league, round.label(), round.markerMatchId(), round.deadline(),
                            standing.livesLeft()));
                }
            }
        }
        return pending;
    }

    /** Jornada con partidos aún abiertos y cuyo primer cierre cae antes del horizonte. */
    private record Round(String label, Long markerMatchId, Instant firstStart, Instant deadline) {}

    private static List<Round> dueRounds(Edition edition, List<Match> calendar, Instant now, Instant horizon) {
        Map<String, List<Match>> byRound = new LinkedHashMap<>();
        for (Match match : calendar) {
            if (match == null || match.getId() == null) continue;
            if (Team.isPlaceholder(match.getHomeTeam()) && Team.isPlaceholder(match.getAwayTeam())) continue;
            byRound.computeIfAbsent(MatchRound.label(match), key -> new ArrayList<>()).add(match);
        }
        List<Round> due = new ArrayList<>();
        for (Map.Entry<String, List<Match>> entry : byRound.entrySet()) {
            List<Match> matches = entry.getValue();
            // Mismo criterio que SurvivorRules: una jornada con algún partido sin fecha aún no puede eliminar.
            if (matches.stream().anyMatch(m -> m.getMatchDate() == null)) continue;
            Map<Long, Instant> locks = MatchdayLock.lockTimes(edition, matches, calendar);
            List<Instant> open = matches.stream()
                    .filter(SurvivorReminderService::isPickable)
                    .map(m -> locks.get(m.getId()))
                    .filter(lock -> lock != null && lock.isAfter(now))
                    .sorted()
                    .toList();
            // Cuenta el primer cierre de la jornada aunque ya haya pasado: quien entra con la jornada empezada
            // también recibe el aviso mientras quede algún partido abierto.
            Instant firstLock = locks.values().stream().min(Comparator.naturalOrder()).orElse(null);
            if (open.isEmpty() || firstLock == null || firstLock.isAfter(horizon)) continue;
            Instant firstStart = matches.stream().map(Match::getMatchDate).min(Comparator.naturalOrder()).orElseThrow();
            Long marker = matches.stream().map(Match::getId).min(Comparator.naturalOrder()).orElseThrow();
            due.add(new Round(entry.getKey(), marker, firstStart, open.get(open.size() - 1)));
        }
        return due;
    }

    private static boolean isPickable(Match match) {
        if (Boolean.TRUE.equals(match.getFinished())) return false;
        if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) return false;
        // Para elegir hacen falta los dos equipos.
        return !Team.isPlaceholder(match.getHomeTeam()) && !Team.isPlaceholder(match.getAwayTeam());
    }

    /** «Elige tu equipo de la Jornada 13 antes del sábado 16:15 o quedarás eliminado». */
    PushMessage message(Pending p, Instant now) {
        String consequence = p.livesLeft() > 1 ? "perderás una vida" : "quedarás eliminado";
        String title = "Te falta elegir equipo en " + p.league().getName();
        String body = "Elige tu equipo " + roundPhrase(p.round()) + " antes del " + when(p.deadline(), now)
                + " o " + consequence;
        return new PushMessage(title, body, "/jornadas?group=" + p.league().getId(), "survivor-reminder");
    }

    private static String roundPhrase(String round) {
        if (round.regionMatches(true, 0, "Jornada", 0, "Jornada".length())) return "de la " + round;
        if (NflSchedule.isRoundLabel(round)) return "de la " + round;
        if (round.startsWith("Fecha ")) {
            try {
                return "de la jornada del " + DAY.format(java.time.LocalDate.parse(round.substring(6))
                        .atStartOfDay(AppTime.ZONE));
            } catch (java.time.format.DateTimeParseException e) {
                return "de " + round;
            }
        }
        return "de " + round;
    }

    /** Día de la semana y hora; con la fecha si queda a más de seis días (o el día sería ambiguo). */
    private static String when(Instant deadline, Instant now) {
        boolean far = Duration.between(now, deadline).compareTo(Duration.ofDays(6)) > 0;
        return (far ? WEEKDAY_DATE_TIME : WEEKDAY_TIME).format(deadline);
    }
}
