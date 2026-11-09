package app.porrapp.service.notification;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.MatchReminderSent;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.Team;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchReminderSentRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SurvivorReminderServiceTest {

    /** Viernes 13 de noviembre de 2026, 10:00 en Madrid. */
    private static final Instant NOW = AppTime.fromLocal(LocalDateTime.of(2026, 11, 13, 10, 0));
    private static final Instant FRIDAY_NIGHT = AppTime.fromLocal(LocalDateTime.of(2026, 11, 13, 21, 0));
    private static final Instant SATURDAY = AppTime.fromLocal(LocalDateTime.of(2026, 11, 14, 16, 15));

    private final EditionRepository editions = mock(EditionRepository.class);
    private final MatchRepository matches = mock(MatchRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final MatchPredictionRepository predictions = mock(MatchPredictionRepository.class);
    private final MatchReminderSentRepository reminders = mock(MatchReminderSentRepository.class);
    private final PushSubscriptionRepository subscriptions = mock(PushSubscriptionRepository.class);
    private final WebPushSender sender = mock(WebPushSender.class);
    private final ObjectMapper json = JsonMapper.builder().build();
    private final PushNotificationLogService notificationLog = mock(PushNotificationLogService.class);
    private final SurvivorReminderService service = new SurvivorReminderService(editions, matches, memberships,
            predictions, reminders, subscriptions, sender, json, notificationLog);

    private final League league = League.builder().id(5L).name("Los del barrio").joinCode("BARRIO").build();
    private final Competition competition = Competition.builder().id(9L).build();
    private final UserAccount ana = user(1L, true);
    private final UserAccount luis = user(2L, true);
    private final UserAccount muted = user(3L, false);
    private final List<Match> calendar = new ArrayList<>();
    private final List<MatchPrediction> picks = new ArrayList<>();
    private Edition edition;
    private Match friday;
    private Match saturday;

    @BeforeEach
    void setUp() {
        edition = Edition.builder().id(50L).league(league).competition(competition)
                .poolFormat(PoolFormat.SURVIVOR).lockMode(PredictionLockMode.PER_MATCH).build();
        friday = match(100L, FRIDAY_NIGHT, "Jornada 13");
        saturday = match(101L, SATURDAY, "Jornada 13");
        calendar.addAll(List.of(friday, saturday));
        when(editions.findActiveByPoolFormat(PoolFormat.SURVIVOR)).thenReturn(List.of(edition));
        when(matches.findByCompetitionId(9L)).thenReturn(calendar);
        when(memberships.findByLeagueId(5L)).thenReturn(List.of(member(ana), member(luis), member(muted)));
        when(predictions.findWithMatchAndUserByEditionId(50L)).thenReturn(picks);
        when(reminders.findKeysByMatchIdIn(any())).thenReturn(List.of());
    }

    @Test
    void remindsOnlyAliveMembersWhoHaveNotPickedInTheRound() {
        picks.add(pick(luis, saturday, "1"));

        List<SurvivorReminderService.Pending> pending = service.findPending(NOW);

        assertThat(pending).extracting(SurvivorReminderService.Pending::userId).containsExactly(1L);
        SurvivorReminderService.Pending p = pending.get(0);
        assertThat(p.round()).isEqualTo("Jornada 13");
        assertThat(p.markerMatchId()).isEqualTo(100L);
        assertThat(p.deadline()).isEqualTo(SATURDAY);
    }

    @Test
    void skipsMembersAlreadyEliminated() {
        Match lost = match(90L, NOW.minus(7, ChronoUnit.DAYS), "Jornada 12");
        lost.setFinished(true);
        lost.setHomeScore(0);
        lost.setAwayScore(2);
        calendar.add(lost);
        picks.add(pick(ana, lost, "1"));
        Match won = match(91L, NOW.minus(7, ChronoUnit.DAYS), "Jornada 12");
        won.setFinished(true);
        won.setHomeScore(1);
        won.setAwayScore(0);
        calendar.add(won);
        picks.add(pick(luis, won, "1"));

        assertThat(service.findPending(NOW)).extracting(SurvivorReminderService.Pending::userId).containsExactly(2L);
    }

    @Test
    void waitsUntilTheRoundIsLessThanADayFromClosing() {
        friday.setMatchDate(NOW.plus(25, ChronoUnit.HOURS));

        assertThat(service.findPending(NOW)).isEmpty();
    }

    @Test
    void keepsRemindingWhileTheRoundHasMatchesOpenAfterItStarted() {
        friday.setMatchDate(NOW.minus(1, ChronoUnit.HOURS));
        friday.setFinished(true);

        assertThat(service.findPending(NOW)).extracting(SurvivorReminderService.Pending::userId)
                .containsExactly(1L, 2L);
    }

    @Test
    void ignoresRoundsWithEveryMatchAlreadyStarted() {
        friday.setMatchDate(NOW.minus(2, ChronoUnit.HOURS));
        saturday.setMatchDate(NOW.minus(1, ChronoUnit.HOURS));

        assertThat(service.findPending(NOW)).isEmpty();
    }

    @Test
    void doesNotRemindAboutARoundThatStartedBeforeJoining() {
        friday.setMatchDate(NOW.minus(1, ChronoUnit.HOURS));
        Membership late = member(ana);
        late.setJoinedAt(NOW.minus(10, ChronoUnit.MINUTES));
        when(memberships.findByLeagueId(5L)).thenReturn(List.of(late));

        assertThat(service.findPending(NOW)).isEmpty();
    }

    @Test
    void doesNotRepeatTheReminderButIgnoresMatchReminders() {
        when(reminders.findKeysByMatchIdIn(any())).thenReturn(List.of(
                new MatchReminderSent.Key(1L, 100L, MatchReminderSent.survivor(5L)),
                new MatchReminderSent.Key(2L, 100L)));

        assertThat(service.findPending(NOW)).extracting(SurvivorReminderService.Pending::userId).containsExactly(2L);
    }

    @Test
    void sendsOneReminderAndRecordsItForTheRound() {
        when(subscriptions.findByUserIdIn(any())).thenReturn(List.of(device(ana, "https://push/ana")));
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.SENT);

        assertThat(service.sendReminders(NOW)).isEqualTo(1);

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(sender).send(eq("https://push/ana"), anyString(), anyString(), payload.capture(), anyInt());
        assertThat(payload.getValue()).contains("Elige tu equipo de la Jornada 13 antes del sábado 16:15")
                .contains("/jornadas?group=5");
        ArgumentCaptor<MatchReminderSent> saved = ArgumentCaptor.forClass(MatchReminderSent.class);
        verify(reminders).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo(new MatchReminderSent.Key(1L, 100L, "SURVIVOR:5"));
    }

    @Test
    void retriesWhenNoDeviceReceivedIt() {
        when(subscriptions.findByUserIdIn(any())).thenReturn(List.of(device(ana, "https://push/ana")));
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(WebPushSender.Result.FAILED);

        assertThat(service.sendReminders(NOW)).isZero();
        verify(reminders, never()).save(any());
    }

    @Test
    void warnsAboutEliminationOrALostLife() {
        SurvivorReminderService.Pending last =
                new SurvivorReminderService.Pending(1L, league, "Jornada 13", 100L, SATURDAY, 1);
        SurvivorReminderService.Pending spare =
                new SurvivorReminderService.Pending(1L, league, "Jornada 13", 100L, SATURDAY, 2);

        PushMessage message = service.message(last, NOW);

        assertThat(message.title()).isEqualTo("Te falta elegir equipo en Los del barrio");
        assertThat(message.body())
                .isEqualTo("Elige tu equipo de la Jornada 13 antes del sábado 16:15 o quedarás eliminado");
        assertThat(service.message(spare, NOW).body()).endsWith("o perderás una vida");
    }

    @Test
    void addsTheDateWhenTheDeadlineIsMoreThanSixDaysAway() {
        SurvivorReminderService.Pending far = new SurvivorReminderService.Pending(1L, league, "Grupo A", 100L,
                SATURDAY.plus(7, ChronoUnit.DAYS), 1);

        assertThat(service.message(far, NOW).body())
                .isEqualTo("Elige tu equipo de Grupo A antes del sábado 21/11 16:15 o quedarás eliminado");
    }

    @Test
    void doesNothingWithoutVapidKeys() {
        when(sender.isEnabled()).thenReturn(false);

        service.sendDueReminders();

        verify(editions, never()).findActiveByPoolFormat(any());
    }

    private static UserAccount user(Long id, boolean reminders) {
        return UserAccount.builder().id(id).googleEmail(id + "@test").participantName("u" + id)
                .matchRemindersEnabled(reminders).build();
    }

    private Membership member(UserAccount user) {
        return Membership.builder().id(new Membership.MembershipId(user.getId(), 5L)).user(user).league(league)
                .joinedAt(NOW.minus(30, ChronoUnit.DAYS)).build();
    }

    private MatchPrediction pick(UserAccount user, Match match, String sign) {
        Prediction prediction = Prediction.builder().user(user).edition(edition).build();
        return MatchPrediction.builder().prediction(prediction).match(match).predictionSign(sign).build();
    }

    private static Match match(Long id, Instant kickoff, String round) {
        return Match.builder().id(id).matchDate(kickoff).round(round)
                .homeTeam(Team.builder().id(id * 10).name("Betis").build())
                .awayTeam(Team.builder().id(id * 10 + 1).name("Sevilla").build())
                .build();
    }

    private static PushSubscription device(UserAccount user, String endpoint) {
        return PushSubscription.builder().user(user).endpoint(endpoint).p256dh("k").auth("a").build();
    }
}
