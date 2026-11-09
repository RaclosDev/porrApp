package com.porra.mundial.service.notification;

import com.porra.mundial.model.Competition;
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
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MatchdayFinishedNotifierTest {

    private static final Instant NOW = AppTime.fromLocal(LocalDateTime.of(2026, 11, 8, 23, 0));

    private final EditionRepository editions = mock(EditionRepository.class);
    private final MatchRepository matches = mock(MatchRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final MatchdayFinishedNoticeRepository notices = mock(MatchdayFinishedNoticeRepository.class);
    private final MatchSelectionService selection = mock(MatchSelectionService.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final PushNotificationLogService notificationLog = mock(PushNotificationLogService.class);
    private final MatchdayFinishedNotifier notifier = new MatchdayFinishedNotifier(editions, matches, memberships,
            subscriptions, notices, selection, sender, JsonMapper.builder().build(), notificationLog,
            mock(PlatformTransactionManager.class));

    private final League league = League.builder().id(5L).name("Los del barrio").joinCode("BARRIO").build();
    private final Competition competition = Competition.builder().id(9L).build();
    private final UserAccount ana = user(1L, true);
    private final UserAccount muted = user(2L, false);

    @BeforeEach
    void setUp() {
        Edition edition = Edition.builder().id(50L).league(league).competition(competition)
                .poolFormat(PoolFormat.MATCH_DAY).build();
        when(editions.findActiveByPoolFormat(PoolFormat.MATCH_DAY)).thenReturn(List.of(edition));
        when(editions.findActiveByPoolFormat(PoolFormat.SURVIVOR)).thenReturn(List.of());
        when(notices.findKeysByEditionIdIn(any())).thenReturn(List.of());
        when(memberships.findByLeagueId(5L)).thenReturn(List.of(member(ana), member(muted)));
    }

    @Test
    void detectsAMatchdayOnceAllItsMatchesHaveFinished() {
        calendar(finished(1L, "Jornada 12", NOW.minus(26, ChronoUnit.HOURS)),
                finished(2L, "Jornada 12", NOW.minus(3, ChronoUnit.HOURS)),
                scheduled(3L, "Jornada 13", NOW.plus(6, ChronoUnit.DAYS)));

        assertThat(notifier.findFinished(NOW)).extracting(MatchdayFinishedNotifier.Finished::matchday)
                .containsExactly("Jornada 12");
    }

    @Test
    void waitsWhileAMatchOfTheMatchdayIsStillToFinish() {
        Match live = scheduled(2L, "Jornada 12", NOW.minus(1, ChronoUnit.HOURS));
        live.setStatus(MatchStatusNormalized.LIVE);
        calendar(finished(1L, "Jornada 12", NOW.minus(3, ChronoUnit.HOURS)), live);

        assertThat(notifier.findFinished(NOW)).isEmpty();
    }

    @Test
    void aPostponedMatchDoesNotHoldBackTheMatchday() {
        Match postponed = scheduled(2L, "Jornada 12", NOW.plus(20, ChronoUnit.DAYS));
        postponed.setStatus(MatchStatusNormalized.POSTPONED);
        calendar(finished(1L, "Jornada 12", NOW.minus(3, ChronoUnit.HOURS)), postponed);

        assertThat(notifier.findFinished(NOW)).hasSize(1);
    }

    @Test
    void skipsOldOrAlreadyNotifiedMatchdays() {
        calendar(finished(1L, "Jornada 10", NOW.minus(8, ChronoUnit.DAYS)),
                finished(2L, "Jornada 11", NOW.minus(2, ChronoUnit.HOURS)));
        when(notices.findKeysByEditionIdIn(any()))
                .thenReturn(List.of(new MatchdayFinishedNotice.Key(50L, "Jornada 11")));

        assertThat(notifier.findFinished(NOW)).isEmpty();
    }

    @Test
    void notifiesMembersWithAlertsOnAndRecordsTheMatchday() {
        calendar(finished(1L, "Jornada 12", NOW.minus(3, ChronoUnit.HOURS)));
        PushSubscription phone = device(ana, "https://push/ana");
        when(subscriptions.findByUserIdIn(Set.of(1L))).thenReturn(List.of(phone));
        when(sender.send(eq(phone.getEndpoint()), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.SENT);

        assertThat(notifier.notifyFinished(NOW)).isEqualTo(1);

        ArgumentCaptor<MatchdayFinishedNotice> saved = ArgumentCaptor.forClass(MatchdayFinishedNotice.class);
        verify(notices).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo(new MatchdayFinishedNotice.Key(50L, "Jornada 12"));
        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(notificationLog).record(eq(1L), message.capture(), eq(NOW));
        assertThat(message.getValue().url()).isEqualTo("/ranking?group=5&jornada=Jornada%2012");
        assertThat(message.getValue().body()).startsWith("Jornada 12 de Los del barrio");
    }

    @Test
    void recordsTheMatchdayEvenWhenNobodyWantsTheAlert() {
        when(memberships.findByLeagueId(5L)).thenReturn(List.of(member(muted)));
        calendar(finished(1L, "Jornada 12", NOW.minus(3, ChronoUnit.HOURS)));

        assertThat(notifier.notifyFinished(NOW)).isZero();
        verify(notices).save(any());
        verify(sender, never()).send(anyString(), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void showsWeekAndDayMatchdaysAsDates() {
        assertThat(MatchdayFinishedNotifier.displayMatchday("Semana 2026-11-02")).isEqualTo("Semana del 2 nov");
        assertThat(MatchdayFinishedNotifier.displayMatchday("Fecha 2026-11-08")).isEqualTo("Jornada del 8 nov");
        assertThat(MatchdayFinishedNotifier.displayMatchday("Octavos de final")).isEqualTo("Octavos de final");
    }

    private void calendar(Match... calendar) {
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(calendar));
    }

    private static Match finished(Long id, String round, Instant kickoff) {
        Match match = scheduled(id, round, kickoff);
        match.setFinished(true);
        match.setStatus(MatchStatusNormalized.FINISHED);
        return match;
    }

    private static Match scheduled(Long id, String round, Instant kickoff) {
        return Match.builder().id(id).round(round).matchDate(kickoff).build();
    }

    private static UserAccount user(Long id, boolean alerts) {
        return UserAccount.builder().id(id).googleEmail(id + "@test").participantName("u" + id)
                .matchdayFinishedAlertsEnabled(alerts).build();
    }

    private Membership member(UserAccount user) {
        return Membership.builder().id(new Membership.MembershipId(user.getId(), 5L)).user(user).league(league).build();
    }

    private static PushSubscription device(UserAccount user, String endpoint) {
        return PushSubscription.builder().user(user).endpoint(endpoint).p256dh("k").auth("a").build();
    }
}
