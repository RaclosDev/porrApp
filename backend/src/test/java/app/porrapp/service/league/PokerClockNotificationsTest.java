package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.model.*;
import app.porrapp.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PokerClockNotificationsTest {
    @Mock LeagueRepository leagues;
    @Mock UserAccountRepository users;
    @Mock MembershipRepository memberships;
    @Mock ScoreboardRoster roster;
    @Mock ScoreTrackerPlayerRepository players;
    @Mock PokerSessionRepository sessions;
    @Mock ApplicationEventPublisher events;
    @InjectMocks PokerLeagueService service;

    @Test
    void startingNotifiesConfirmedMembersWithDirectTableLinkOnlyOnce() {
        var admin = UserAccount.builder().id(7L).googleEmail("admin@example.invalid").build();
        var member = UserAccount.builder().id(2L).build();
        var league = League.builder().id(1L).name("Sábados").kind(League.KIND_POKER).adminUser(admin).build();
        var session = new PokerSession();
        session.setId(3L);
        session.setLeagueId(1L);
        session.setScheduledOn(java.time.LocalDate.now());
        session.setSettings(new Settings(1000, 10000, null, null, List.of(100),
                List.of(new BlindLevel(15, 25, 50, 0))));
        session.setEntries(List.of(new Entry(4L, "Ana", 0, 0), new Entry(8L, "Invitado", 0, 0)));
        when(users.findByGoogleEmail(admin.getGoogleEmail())).thenReturn(Optional.of(admin));
        when(memberships.existsById(new Membership.MembershipId(7L, 1L))).thenReturn(true);
        when(leagues.findWithLockById(1L)).thenReturn(Optional.of(league));
        when(sessions.findByIdAndLeagueId(3L, 1L)).thenReturn(Optional.of(session));
        when(sessions.findByLeagueIdAndClosedAtIsNull(1L)).thenReturn(Optional.of(session));
        when(memberships.findByLeagueId(1L)).thenReturn(List.of(Membership.builder().user(member).build()));
        when(players.findByLeagueIdOrderByPositionAsc(1L)).thenReturn(List.of(
                ScoreTrackerPlayer.builder().id(4L).name("Ana").userId(2L).build(),
                ScoreTrackerPlayer.builder().id(8L).name("Invitado").build(),
                ScoreTrackerPlayer.builder().id(9L).name("Sin confirmar").userId(10L).build()));

        service.command(admin.getGoogleEmail(), 1L, 3L, new Command(Action.START, 0L, null));
        service.command(admin.getGoogleEmail(), 1L, 3L, new Command(Action.PAUSE, 1L, null));
        var event = ArgumentCaptor.forClass(PokerNotificationEvent.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue().recipients()).containsExactly(2L);
        assertThat(event.getValue().message().title()).isEqualTo("Ha empezado el torneo");
        assertThat(event.getValue().message().body()).contains("Sábados", "Ciegas 25 / 50");
        assertThat(event.getValue().message().url()).isEqualTo("/poker/mesa?group=1");
    }

    @Test
    void expiredLevelsNotifyParticipantsOnceIncludingBreaksAndNewBlinds() {
        var league = League.builder().id(1L).name("Sábados").kind(League.KIND_POKER).build();
        var user = UserAccount.builder().id(2L).build();
        var session = new PokerSession();
        session.setId(3L);
        session.setLeagueId(1L);
        session.setSettings(new Settings(1000, 10000, null, null, List.of(100),
                List.of(new BlindLevel(1, 25, 50, 0), new BlindLevel(1, 0, 0, 0),
                        new BlindLevel(1, 50, 100, 10))));
        session.setEntries(List.of(new Entry(4L, "Ana", 0, 0)));
        session.setBlindClock(new BlindClock(0, System.currentTimeMillis() - 1000, 60000));
        when(leagues.findWithLockById(1L)).thenReturn(Optional.of(league));
        when(sessions.findByLeagueIdAndClosedAtIsNull(1L)).thenReturn(Optional.of(session));
        when(memberships.findByLeagueId(1L)).thenReturn(List.of(Membership.builder().user(user).build()));
        when(players.findByLeagueIdOrderByPositionAsc(1L)).thenReturn(List.of(
                ScoreTrackerPlayer.builder().id(4L).userId(2L).build(),
                ScoreTrackerPlayer.builder().id(5L).userId(6L).build()));

        service.advanceClock(1L);
        service.advanceClock(1L);
        var event = ArgumentCaptor.forClass(PokerNotificationEvent.class);
        verify(events).publishEvent(event.capture());
        assertThat(event.getValue().recipients()).containsExactly(2L);
        assertThat(event.getValue().message().body()).contains("Sábados", "descanso de 1 minutos");
        assertThat(session.getBlindClock().level()).isEqualTo(1);

        session.setBlindClock(new BlindClock(1, System.currentTimeMillis() - 1000, 60000));
        service.advanceClock(1L);
        verify(events, times(2)).publishEvent(event.capture());
        assertThat(event.getValue().message().body()).contains("Ciegas 50 / 100", "Ante 10");
        session.setBlindClock(new BlindClock(2, System.currentTimeMillis() - 1000, 60000));
        service.advanceClock(1L);
        service.advanceClock(1L);
        verify(events, times(3)).publishEvent(event.capture());
        assertThat(event.getValue().message().title()).contains("último nivel");
    }
}
