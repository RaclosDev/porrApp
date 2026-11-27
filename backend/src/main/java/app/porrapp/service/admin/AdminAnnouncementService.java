package app.porrapp.service.admin;

import app.porrapp.dto.AdminAnnouncementRequest;
import app.porrapp.dto.AdminAnnouncementResult;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.service.notification.PushMessage;
import app.porrapp.service.notification.PushNotificationLogService;
import app.porrapp.service.notification.WebPushSender;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Avisos push que el administrador manda a mano a los miembros de una o varias ligas.
 * <p>
 * No dependen de las preferencias de avisos de cada usuario (recordatorios, nuevos miembros, fin de
 * jornada): son de otra clase, se mandan de tarde en tarde y solo llegan a quien tiene activados los
 * avisos push en algún dispositivo, que es el consentimiento que se pide. Quien esté en varias de
 * las ligas elegidas lo recibe una sola vez por dispositivo.
 * <p>
 * El límite de envíos se lleva en memoria: producción tiene una sola réplica.
 */
@Slf4j
@Service
public class AdminAnnouncementService {

    public static final int MAX_TITLE = 60;
    public static final int MAX_BODY = 240;
    public static final int MAX_LEAGUES = 20;
    static final int MAX_SENDS_PER_WINDOW = 5;
    static final Duration WINDOW = Duration.ofHours(1);
    /** Si el dispositivo está apagado más de un día, el aviso ya no interesa. */
    static final int TTL_SECONDS = 24 * 60 * 60;

    private final LeagueRepository leagueRepository;
    private final MembershipRepository membershipRepository;
    private final PushSubscriptionRepository subscriptionRepository;
    private final WebPushSender sender;
    private final ObjectMapper objectMapper;
    private final PushNotificationLogService notificationLog;
    private final Clock clock;
    private final Map<String, Deque<Instant>> recentSends = new ConcurrentHashMap<>();

    @Autowired
    public AdminAnnouncementService(LeagueRepository leagueRepository, MembershipRepository membershipRepository,
                                    PushSubscriptionRepository subscriptionRepository, WebPushSender sender,
                                    ObjectMapper objectMapper, PushNotificationLogService notificationLog) {
        this(leagueRepository, membershipRepository, subscriptionRepository, sender, objectMapper, notificationLog,
                Clock.systemUTC());
    }

    AdminAnnouncementService(LeagueRepository leagueRepository, MembershipRepository membershipRepository,
                             PushSubscriptionRepository subscriptionRepository, WebPushSender sender,
                             ObjectMapper objectMapper, PushNotificationLogService notificationLog, Clock clock) {
        this.leagueRepository = leagueRepository;
        this.membershipRepository = membershipRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.sender = sender;
        this.objectMapper = objectMapper;
        this.notificationLog = notificationLog;
        this.clock = clock;
    }

    /** Manda el aviso; {@code adminEmail} ya debe estar comprobado como administrador. */
    public AdminAnnouncementResult send(String adminEmail, AdminAnnouncementRequest request) {
        if (request == null) throw BusinessException.badRequest("Faltan los datos del aviso.");
        String title = clean(request.title(), MAX_TITLE, false, "El título");
        String body = clean(request.body(), MAX_BODY, true, "El texto");
        Set<Long> leagueIds = leagueIds(request.leagueIds());
        if (!sender.isEnabled()) {
            throw BusinessException.conflict("Los avisos push no están configurados en el servidor.");
        }
        List<League> leagues = leagueRepository.findAllById(leagueIds);
        if (leagues.size() != leagueIds.size()) throw BusinessException.badRequest("Alguna de las ligas ya no existe.");

        Instant now = clock.instant();
        reserveSend(adminEmail, now);

        Set<Long> recipients = new HashSet<>();
        for (League league : leagues) {
            membershipRepository.findByLeagueId(league.getId()).stream()
                    .map(Membership::getUser)
                    .filter(Objects::nonNull)
                    .map(UserAccount::getId)
                    .filter(Objects::nonNull)
                    .forEach(recipients::add);
        }
        PushMessage message = new PushMessage(title, body, "/", "admin-announcement-" + now.toEpochMilli());
        String payload = message.toJson(objectMapper);
        int sent = 0;
        int retrying = 0;
        int failed = 0;
        Set<Long> reached = new HashSet<>();
        List<PushSubscription> devices = recipients.isEmpty() ? List.of()
                : subscriptionRepository.findByUserIdIn(recipients);
        for (PushSubscription device : devices) {
            Long userId = device.getUser().getId();
            if (!recipients.contains(userId)) continue;
            WebPushSender.Result result = sender.send(device.getEndpoint(), device.getP256dh(), device.getAuth(),
                    payload, TTL_SECONDS, userId);
            switch (result) {
                case SENT -> {
                    sent++;
                    reached.add(userId);
                }
                case QUEUED -> retrying++;
                case GONE -> {
                    failed++;
                    subscriptionRepository.deleteByEndpoint(device.getEndpoint());
                }
                case FAILED, REJECTED -> failed++;
            }
        }
        reached.forEach(userId -> notificationLog.record(userId, message, now));
        log.info("Aviso del administrador a {} ligas: {} miembros, {} dispositivos, {} enviados, {} en reintento, {} fallidos",
                leagues.size(), recipients.size(), sent + retrying + failed, sent, retrying, failed);
        return new AdminAnnouncementResult(leagues.size(), recipients.size(), sent + retrying + failed, sent, retrying,
                failed);
    }

    /** Cuenta el envío si quedan en la ventana; si no, 429. */
    private void reserveSend(String adminEmail, Instant now) {
        String key = adminEmail == null ? "" : adminEmail.trim().toLowerCase(Locale.ROOT);
        Deque<Instant> sends = recentSends.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (sends) {
            while (!sends.isEmpty() && !sends.peekFirst().isAfter(now.minus(WINDOW))) sends.pollFirst();
            if (sends.size() >= MAX_SENDS_PER_WINDOW) {
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,
                        "Has enviado " + MAX_SENDS_PER_WINDOW + " avisos en la última hora. Espera un poco antes de mandar otro.");
            }
            sends.addLast(now);
        }
    }

    private static Set<Long> leagueIds(List<Long> ids) {
        Set<Long> unique = new LinkedHashSet<>();
        if (ids != null) ids.stream().filter(Objects::nonNull).forEach(unique::add);
        if (unique.isEmpty()) throw BusinessException.badRequest("Elige al menos una liga.");
        if (unique.size() > MAX_LEAGUES) {
            throw BusinessException.badRequest("Como mucho " + MAX_LEAGUES + " ligas por aviso.");
        }
        return unique;
    }

    /** Recorta espacios, quita caracteres de control (salvo saltos de línea en el texto) y comprueba la longitud. */
    static String clean(String value, int max, boolean multiline, String field) {
        String text = value == null ? "" : value.strip();
        StringBuilder out = new StringBuilder(text.length());
        text.codePoints().forEach(cp -> {
            if (cp == 13) return; // retorno de carro de los saltos de línea de Windows
            if (cp == '\n' && multiline) out.append('\n');
            else if (Character.isISOControl(cp)) out.append(' ');
            else out.appendCodePoint(cp);
        });
        String result = out.toString().replaceAll("\n{3,}", "\n\n").strip();
        if (result.isEmpty()) throw BusinessException.badRequest(field + " no puede estar vacío.");
        if (result.codePointCount(0, result.length()) > max) {
            throw BusinessException.badRequest(field + " admite como mucho " + max + " caracteres.");
        }
        return result;
    }
}
