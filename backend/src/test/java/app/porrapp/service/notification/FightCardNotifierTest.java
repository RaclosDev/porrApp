package app.porrapp.service.notification;

import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FightCardNotifierTest {

    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final ObjectMapper json = JsonMapper.builder().build();
    private final PushNotificationLogService notificationLog = mock(PushNotificationLogService.class);
    private final FightCardNotifier notifier = new FightCardNotifier(users, subscriptions, sender, json, notificationLog);

    private final UserAccount ana = user(1L, true);
    private final UserAccount luis = user(2L, false);

    @BeforeEach
    void setUp() {
        when(sender.isEnabled()).thenReturn(true);
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.SENT);
        when(users.findAllById(any())).thenReturn(List.of(ana, luis));
        when(subscriptions.findByUserIdIn(anyCollection()))
                .thenReturn(List.of(device(ana, "https://push/ana"), device(luis, "https://push/luis")));
    }

    @Test
    void warnsWhoPredictedAndHasRemindersOn() {
        int sent = notifier.notify(List.of(
                notice(ana, 7L, "Pelea cancelada", "A vs. B se ha caído de la cartelera. Tu predicción no cuenta."),
                notice(luis, 7L, "Pelea cancelada", "A vs. B se ha caído de la cartelera. Tu predicción no cuenta.")));

        assertThat(sent).isEqualTo(1);
        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(sender).send(eq("https://push/ana"), anyString(), anyString(), payload.capture(),
                eq(FightCardNotifier.TTL_SECONDS));
        verify(sender, never()).send(eq("https://push/luis"), anyString(), anyString(), anyString(), anyInt());
        assertThat(payload.getValue()).contains("Pelea cancelada").contains("/jornadas?group=7");
        verify(notificationLog).record(eq(1L), any(), any());
    }

    @Test
    void severalChangesGoInOneNotice() {
        PushMessage message = FightCardNotifier.message(List.of(
                notice(ana, 7L, "Pelea cancelada", "uno"),
                notice(ana, 7L, "Rojo tiene nuevo rival", "dos")));

        assertThat(message.title()).isEqualTo("Cambios en la cartelera");
        assertThat(message.body()).startsWith("Veladas: 2 predicciones anuladas");
        assertThat(message.url()).isEqualTo("/jornadas?group=7");
    }

    @Test
    void nothingIsSentWithoutPush() {
        when(sender.isEnabled()).thenReturn(false);

        assertThat(notifier.notify(List.of(notice(ana, 7L, "Pelea cancelada", "uno")))).isZero();
        verify(sender, never()).send(anyString(), anyString(), anyString(), anyString(), anyInt());
    }

    private static FightCardChangedEvent.Notice notice(UserAccount user, Long leagueId, String title, String body) {
        return new FightCardChangedEvent.Notice(user.getId(), leagueId, "Veladas", title, body);
    }

    private static UserAccount user(Long id, boolean reminders) {
        return UserAccount.builder().id(id).googleEmail(id + "@test").participantName("u" + id)
                .matchRemindersEnabled(reminders).build();
    }

    private static PushSubscription device(UserAccount user, String endpoint) {
        return PushSubscription.builder().user(user).endpoint(endpoint).p256dh("k").auth("a").build();
    }
}
