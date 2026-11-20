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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminAnnouncementServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-20T10:00:00Z");
    private static final String ADMIN = "boss@example.com";

    private final LeagueRepository leagues = mock(LeagueRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final PushNotificationLogService notificationLog = mock(PushNotificationLogService.class);
    private final MutableClock clock = new MutableClock(NOW);
    private final AdminAnnouncementService service = new AdminAnnouncementService(leagues, memberships,
            subscriptions, sender, JsonMapper.builder().build(), notificationLog, clock);

    private final League barrio = League.builder().id(1L).name("Barrio").joinCode("BARRIO").build();
    private final League oficina = League.builder().id(2L).name("Oficina").joinCode("OFI").build();
    private final UserAccount ana = user(10L);
    private final UserAccount luis = user(11L);

    @BeforeEach
    void setUp() {
        when(sender.isEnabled()).thenReturn(true);
        when(leagues.findAllById(any())).thenAnswer(inv -> {
            Collection<?> ids = inv.getArgument(0);
            return List.of(barrio, oficina).stream().filter(l -> ids.contains(l.getId())).toList();
        });
        // Ana está en las dos ligas: recibe el aviso una sola vez.
        when(memberships.findByLeagueId(1L)).thenReturn(List.of(member(ana, barrio), member(luis, barrio)));
        when(memberships.findByLeagueId(2L)).thenReturn(List.of(member(ana, oficina)));
    }

    @Test
    void sendsOncePerDeviceAndCountsEachOutcome() {
        when(subscriptions.findByUserIdIn(Set.of(10L, 11L))).thenReturn(List.of(
                device(ana, "https://push/ana-movil"), device(ana, "https://push/ana-pc"),
                device(luis, "https://push/luis"), device(luis, "https://push/luis-viejo")));
        answer("https://push/ana-movil", WebPushSender.Result.SENT);
        answer("https://push/ana-pc", WebPushSender.Result.QUEUED);
        answer("https://push/luis", WebPushSender.Result.SENT);
        answer("https://push/luis-viejo", WebPushSender.Result.GONE);

        AdminAnnouncementResult result = service.send(ADMIN,
                new AdminAnnouncementRequest(List.of(1L, 2L, 1L), "  Novedad  ", "Ya podéis\r\nhacer predicciones."));

        assertThat(result).isEqualTo(new AdminAnnouncementResult(2, 2, 4, 2, 1, 1));
        verify(subscriptions).deleteByEndpoint("https://push/luis-viejo");
        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(notificationLog).record(eq(10L), message.capture(), eq(NOW));
        verify(notificationLog).record(eq(11L), any(), eq(NOW));
        assertThat(message.getValue().title()).isEqualTo("Novedad");
        assertThat(message.getValue().body()).isEqualTo("Ya podéis\nhacer predicciones.");
        verify(sender).send(eq("https://push/luis"), anyString(), anyString(),
                contains("\"title\":\"Novedad\""), eq(AdminAnnouncementService.TTL_SECONDS), eq(11L));
    }

    @Test
    void rejectsEmptyOrTooLongTextsAndBadLeagueLists() {
        assertBadRequest(new AdminAnnouncementRequest(List.of(1L), " ", "Texto"));
        assertBadRequest(new AdminAnnouncementRequest(List.of(1L), "Título", "\n\t"));
        assertBadRequest(new AdminAnnouncementRequest(List.of(1L),
                "x".repeat(AdminAnnouncementService.MAX_TITLE + 1), "Texto"));
        assertBadRequest(new AdminAnnouncementRequest(List.of(1L), "Título",
                "x".repeat(AdminAnnouncementService.MAX_BODY + 1)));
        assertBadRequest(new AdminAnnouncementRequest(List.of(), "Título", "Texto"));
        assertBadRequest(new AdminAnnouncementRequest(null, "Título", "Texto"));
        assertBadRequest(new AdminAnnouncementRequest(
                LongStream.rangeClosed(1, AdminAnnouncementService.MAX_LEAGUES + 1).boxed().toList(), "Título", "Texto"));
        assertBadRequest(new AdminAnnouncementRequest(List.of(1L, 99L), "Título", "Texto"));
        assertBadRequest(null);
        verify(sender, never()).send(anyString(), anyString(), anyString(), anyString(), anyInt(), anyLong());
    }

    @Test
    void emojisCountAsOneCharacterAndTitlesLoseLineBreaks() {
        String trophies = "🏆".repeat(AdminAnnouncementService.MAX_TITLE);
        assertThat(AdminAnnouncementService.clean(trophies, AdminAnnouncementService.MAX_TITLE, false, "El título"))
                .isEqualTo(trophies);
        assertThat(AdminAnnouncementService.clean("Hola\nmundo", 60, false, "El título")).isEqualTo("Hola mundo");
        assertThat(AdminAnnouncementService.clean("a\n\n\n\nb", 60, true, "El texto")).isEqualTo("a\n\nb");
    }

    @Test
    void limitsSendsPerAdminWithinTheWindow() {
        when(subscriptions.findByUserIdIn(any())).thenReturn(List.of());
        var request = new AdminAnnouncementRequest(List.of(1L), "Título", "Texto");
        for (int i = 0; i < AdminAnnouncementService.MAX_SENDS_PER_WINDOW; i++) service.send(ADMIN, request);

        assertThatThrownBy(() -> service.send(ADMIN, request))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));

        clock.advance(AdminAnnouncementService.WINDOW.plusSeconds(1));
        assertThat(service.send(ADMIN, request).members()).isEqualTo(2);
    }

    @Test
    void refusesWhenPushIsNotConfigured() {
        when(sender.isEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service.send(ADMIN, new AdminAnnouncementRequest(List.of(1L), "Título", "Texto")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    private void answer(String endpoint, WebPushSender.Result result) {
        when(sender.send(eq(endpoint), anyString(), anyString(), anyString(), anyInt(), anyLong())).thenReturn(result);
    }

    private void assertBadRequest(AdminAnnouncementRequest request) {
        assertThatThrownBy(() -> service.send(ADMIN, request))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private static UserAccount user(Long id) {
        return UserAccount.builder().id(id).googleEmail(id + "@test").participantName("u" + id).build();
    }

    private static Membership member(UserAccount user, League league) {
        return Membership.builder().id(new Membership.MembershipId(user.getId(), league.getId()))
                .user(user).league(league).build();
    }

    private static PushSubscription device(UserAccount user, String endpoint) {
        return PushSubscription.builder().user(user).endpoint(endpoint).p256dh("k").auth("a").build();
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
