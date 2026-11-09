package com.porra.mundial.service.notification;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.MatchdayFinishedNotice;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MatchdayFinishedNoticeRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.service.prediction.MatchSelectionService;
import com.porra.mundial.util.MatchRound;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Avisa por push a los miembros de una liga por jornadas cuando terminan todos los partidos de una
 * jornada, para que vean cómo queda el ranking. Cada jornada se avisa una sola vez por liga.
 * <p>
 * Los partidos aplazados, suspendidos o cancelados no retienen el aviso: la jornada termina con los
 * que se han jugado. Solo se avisa de jornadas cuyo último partido empezó hace menos de
 * {@link #RECENT}, para no avisar de jornadas antiguas (al desplegar o al unirse a una liga).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchdayFinishedNotifier {

    static final Duration RECENT = Duration.ofHours(24);
    /** Si el dispositivo está apagado más de un día, el aviso ya no interesa. */
    static final int TTL_SECONDS = 24 * 60 * 60;
    /** Fórmula 1 tiene su propio aviso de resultados (GrandPrixResultNotifier). */
    private static final List<PoolFormat> FORMATS = List.of(PoolFormat.MATCH_DAY, PoolFormat.SURVIVOR);
    private static final Set<MatchStatusNormalized> NOT_PLAYED = Set.of(MatchStatusNormalized.POSTPONED,
            MatchStatusNormalized.CANCELLED, MatchStatusNormalized.SUSPENDED);
    private static final Pattern WEEK = Pattern.compile("Semana (\\d{4}-\\d{2}-\\d{2})");
    private static final Pattern DAY = Pattern.compile("Fecha (\\d{4}-\\d{2}-\\d{2})");
    private static final DateTimeFormatter SHORT_DAY = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("es-ES"));

    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final MembershipRepository membershipRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final MatchdayFinishedNoticeRepository noticeRepository;
    private final MatchSelectionService matchSelectionService;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;
    private final PlatformTransactionManager transactionManager;

    /** Jornada recién terminada de la liga de una edición. */
    record Finished(Edition edition, String matchday) {
    }

    @Scheduled(initialDelay = 120_000, fixedDelay = 300_000)
    @SchedulerLock(name = "matchdayFinishedAlerts", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void notifyFinishedMatchdays() {
        if (!sender.isEnabled()) return;
        try {
            int sent = notifyFinished(Instant.now());
            if (sent > 0) log.info("Avisos de fin de jornada entregados a {} usuarios", sent);
        } catch (RuntimeException e) {
            log.error("Fallo al avisar del fin de jornada", e);
        }
    }

    /** @return avisos entregados (un usuario cuenta una vez por liga) */
    int notifyFinished(Instant now) {
        // La jornada de un partido puede depender de su competición (perezosa): se calcula en una transacción.
        TransactionTemplate readOnly = new TransactionTemplate(transactionManager);
        readOnly.setReadOnly(true);
        List<Finished> pending = readOnly.execute(status -> findFinished(now));
        int delivered = 0;
        for (Finished finished : pending == null ? List.<Finished>of() : pending) {
            // Se anota antes de enviar: un fallo a mitad no debe repetir el aviso a quien ya lo recibió.
            noticeRepository.save(new MatchdayFinishedNotice(
                    new MatchdayFinishedNotice.Key(finished.edition().getId(), finished.matchday()), now));
            delivered += notifyMembers(finished, now);
        }
        return delivered;
    }

    /** Jornadas de ligas activas cuyos partidos han terminado todos y que aún no se han avisado. */
    List<Finished> findFinished(Instant now) {
        List<Edition> editions = new ArrayList<>();
        FORMATS.forEach(format -> editions.addAll(editionRepository.findActiveByPoolFormat(format)));
        editions.removeIf(edition -> edition.getLeague() == null || edition.getCompetition() == null);
        if (editions.isEmpty()) return List.of();

        Set<MatchdayFinishedNotice.Key> notified = new HashSet<>(noticeRepository.findKeysByEditionIdIn(
                editions.stream().map(Edition::getId).toList()));
        Map<Long, List<Match>> calendars = new HashMap<>();
        List<Finished> finished = new ArrayList<>();
        for (Edition edition : editions) {
            List<Match> calendar = MatchSelectionService.leagueCalendar(matchSelectionService, edition,
                    id -> calendars.computeIfAbsent(id, matchRepository::findByCompetitionId));
            Map<String, List<Match>> byMatchday = calendar.stream()
                    .filter(m -> m != null && m.getMatchDate() != null)
                    .collect(Collectors.groupingBy(m -> MatchRound.label(edition, m), LinkedHashMap::new,
                            Collectors.toList()));
            byMatchday.forEach((matchday, matches) -> {
                if (matchday == null || matchday.isBlank() || "Sin jornada".equalsIgnoreCase(matchday)) return;
                if (notified.contains(new MatchdayFinishedNotice.Key(edition.getId(), matchday))) return;
                if (isRecentlyFinished(matches, now)) finished.add(new Finished(edition, matchday));
            });
        }
        return finished;
    }

    /** Todos los partidos jugados han terminado, alguno se ha jugado y el último empezó hace poco. */
    static boolean isRecentlyFinished(List<Match> matches, Instant now) {
        Instant lastKickoff = null;
        boolean anyFinished = false;
        for (Match match : matches) {
            if (isFinished(match)) {
                anyFinished = true;
                if (lastKickoff == null || match.getMatchDate().isAfter(lastKickoff)) lastKickoff = match.getMatchDate();
            } else if (match.getStatus() == null || !NOT_PLAYED.contains(match.getStatus())) {
                return false;
            }
        }
        return anyFinished && !lastKickoff.isBefore(now.minus(RECENT));
    }

    private static boolean isFinished(Match match) {
        return Boolean.TRUE.equals(match.getFinished())
                || (match.getStatus() != null && match.getStatus().isFinished());
    }

    /** @return miembros a los que ha llegado el aviso en al menos un dispositivo */
    private int notifyMembers(Finished finished, Instant now) {
        League league = finished.edition().getLeague();
        Set<Long> recipients = membershipRepository.findByLeagueId(league.getId()).stream()
                .map(Membership::getUser)
                .filter(user -> user != null && user.isMatchdayFinishedAlertsEnabled())
                .map(UserAccount::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (recipients.isEmpty()) return 0;

        PushMessage message = message(league, finished.matchday());
        String payload = message.toJson(objectMapper);
        Set<Long> delivered = new HashSet<>();
        for (PushSubscription device : subscriptionRepository.findByUserIdIn(recipients)) {
            Long userId = device.getUser().getId();
            if (!recipients.contains(userId)) continue;
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    payload, TTL_SECONDS);
            if (result == WebPushSender.Result.SENT) delivered.add(userId);
            if (result == WebPushSender.Result.GONE) subscriptionRepository.deleteByEndpoint(device.getEndpoint());
        }
        delivered.forEach(userId -> notificationLog.record(userId, message, now));
        return delivered.size();
    }

    /** Aviso que abre el ranking de la liga en la jornada que acaba de terminar. */
    static PushMessage message(League league, String matchday) {
        String url = "/ranking?group=" + league.getId() + "&jornada="
                + URLEncoder.encode(matchday, StandardCharsets.UTF_8).replace("+", "%20");
        return new PushMessage("Jornada terminada",
                displayMatchday(matchday) + " de " + league.getName()
                        + ": ya están todos los resultados. Mira cómo queda el ranking.",
                url, "matchday-finished-" + league.getId());
    }

    /** «Semana 2026-11-02» → «Semana del 2 nov»; «Fecha 2026-11-08» → «8 nov»; el resto, tal cual. */
    static String displayMatchday(String matchday) {
        Matcher week = WEEK.matcher(matchday);
        if (week.matches()) {
            LocalDate monday = parse(week.group(1));
            if (monday != null) return "Semana del " + SHORT_DAY.format(monday).replace(".", "");
        }
        Matcher day = DAY.matcher(matchday);
        if (day.matches()) {
            LocalDate date = parse(day.group(1));
            if (date != null) return "Jornada del " + SHORT_DAY.format(date).replace(".", "");
        }
        return matchday;
    }

    private static LocalDate parse(String date) {
        try {
            return LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
