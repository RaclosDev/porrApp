package com.porra.mundial.service;

import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PushSubscription;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberJoinedNotifierTest {

    private final LeagueRepository leagues = mock(LeagueRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final ObjectMapper json = JsonMapper.builder().build();
    private final MemberJoinedNotifier notifier = new MemberJoinedNotifier(leagues, users, memberships,
            subscriptions, sender, json);

    private final League league = League.builder().id(5L).name("Los del barrio").joinCode("BARRIO").build();
    private final UserAccount ana = user(1L, "Ana", true);
    private final UserAccount luis = user(2L, "Luis", true);
    private final UserAccount muted = user(3L, "Marta", false);
    private final UserAccount newcomer = user(4L, "Pepe", true);
    private final MemberJoinedLeagueEvent joined = new MemberJoinedLeagueEvent(5L, 4L);

    @BeforeEach
    void setUp() {
        when(sender.isEnabled()).thenReturn(true);
        when(leagues.findById(5L)).thenReturn(Optional.of(league));
        when(users.findById(4L)).thenReturn(Optional.of(newcomer));
        when(memberships.findByLeagueId(5L))
                .thenReturn(List.of(member(ana), member(luis), member(muted), member(newcomer)));
        when(subscriptions.findByUserIdIn(any())).thenAnswer(inv -> {
            Collection<Long> ids = inv.getArgument(0);
            return List.of(device(ana, "a"), device(luis, "l"), device(muted, "m"), device(newcomer, "n")).stream()
                    .filter(d -> ids.contains(d.getUser().getId()))
                    .toList();
        });
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.SENT);
    }

    @Test
    void notifiesTheOtherMembersButNotTheNewcomer() {
        assertThat(notifier.notifyMembers(joined)).isEqualTo(2);

        verify(sender).send(eq("https://push.test/a"), anyString(), anyString(), anyString(), anyInt());
        verify(sender).send(eq("https://push.test/l"), anyString(), anyString(), anyString(), anyInt());
        verify(sender, never()).send(eq("https://push.test/n"), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void respectsTheMemberJoinedPreference() {
        notifier.notifyMembers(joined);

        verify(sender, never()).send(eq("https://push.test/m"), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void neverNotifiesInTheGlobalLeague() {
        League global = League.builder().id(League.GLOBAL_ID).name(League.GLOBAL_NAME)
                .joinCode(League.GLOBAL_JOIN_CODE).build();
        when(leagues.findById(League.GLOBAL_ID)).thenReturn(Optional.of(global));

        assertThat(notifier.notifyMembers(new MemberJoinedLeagueEvent(League.GLOBAL_ID, 4L))).isZero();
        verify(sender, never()).send(anyString(), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void sendsNothingWhenPushIsNotConfigured() {
        when(sender.isEnabled()).thenReturn(false);

        assertThat(notifier.notifyMembers(joined)).isZero();
        verify(sender, never()).send(anyString(), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void forgetsDevicesThatNoLongerExist() {
        when(sender.send(eq("https://push.test/a"), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.GONE);

        assertThat(notifier.notifyMembers(joined)).isEqualTo(1);
        verify(subscriptions).deleteByEndpoint("https://push.test/a");
    }

    @Test
    void aPushFailureIsSwallowed() {
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenThrow(new IllegalStateException("push caído"));

        assertThatCode(() -> notifier.onMemberJoined(joined)).doesNotThrowAnyException();
    }

    @Test
    void payloadNamesTheNewcomerAndOpensTheLeagueWithItsOwnTag() {
        notifier.notifyMembers(joined);

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(sender).send(eq("https://push.test/a"), anyString(), anyString(), payload.capture(), anyInt());
        @SuppressWarnings("unchecked")
        Map<String, Object> message = json.readValue(payload.getValue(), Map.class);
        assertThat(message).containsEntry("title", "Pepe se ha unido a Los del barrio")
                .containsEntry("body", "Ya sois 4 en la liga.")
                .containsEntry("url", "/jornadas?group=5")
                .containsEntry("tag", "member-joined-5");
    }

    private static UserAccount user(Long id, String name, boolean alerts) {
        return UserAccount.builder().id(id).googleEmail(name.toLowerCase() + "@test.com").participantName(name)
                .memberJoinedAlertsEnabled(alerts).build();
    }

    private Membership member(UserAccount user) {
        return Membership.builder().id(new Membership.MembershipId(user.getId(), league.getId()))
                .user(user).league(league).build();
    }

    private static PushSubscription device(UserAccount user, String key) {
        return PushSubscription.builder().user(user).endpoint("https://push.test/" + key).p256dh("p").auth("x").build();
    }
}
