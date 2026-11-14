package app.porrapp.service.league;

import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.service.notification.WebPushSender;
import app.porrapp.config.DataInitializer;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PushSubscriptionRepository;
import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Los avisos de la liga se envían después de confirmar los cambios en Postgres.
 */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=member-joined-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class MemberJoinedPushIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    /** Sin la sincronización inicial ni los goleadores, que llamarían a ESPN. */
    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;
    @MockitoBean private WebPushSender sender;

    @Autowired private LeagueService leagueService;
    @Autowired private LeagueMembershipService membershipService;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private LeagueRepository leagueRepository;
    @Autowired private MembershipRepository membershipRepository;
    @Autowired private PushSubscriptionRepository subscriptionRepository;

    @Test
    void joiningSucceedsAndNotifiesTheOthersEvenIfPushFails() {
        when(sender.isEnabled()).thenReturn(true);
        when(sender.send(anyString(), anyString(), anyString(), anyString(), anyInt(), org.mockito.ArgumentMatchers.anyLong()))
                .thenThrow(new IllegalStateException("push caído"));

        UserAccount owner = userAccountRepository.save(UserAccount.builder()
                .googleEmail("owner-joined@test.invalid").googleName("Owner").participantName("Owner").build());
        UserAccount newcomer = userAccountRepository.save(UserAccount.builder()
                .googleEmail("newcomer-joined@test.invalid").googleName("Pepe").participantName("Pepe").build());
        League league = leagueRepository.save(League.builder().name("Los del barrio").joinCode("BARRIO1")
                .adminUser(owner).build());
        membershipRepository.save(Membership.builder().id(new Membership.MembershipId(owner.getId(), league.getId()))
                .user(owner).league(league).role("ADMIN").build());
        subscriptionRepository.save(PushSubscription.builder().user(owner)
                .endpoint("https://fcm.googleapis.com/fcm/send/owner").p256dh("p").auth("a").build());
        subscriptionRepository.save(PushSubscription.builder().user(newcomer)
                .endpoint("https://fcm.googleapis.com/fcm/send/newcomer").p256dh("p").auth("a").build());

        membershipService.join(league.getId(), newcomer.getGoogleEmail());

        assertThat(membershipRepository.existsById(new Membership.MembershipId(newcomer.getId(), league.getId())))
                .isTrue();
        verify(sender, timeout(10_000)).send(eq("https://fcm.googleapis.com/fcm/send/owner"), anyString(),
                anyString(), contains("Pepe se ha unido a Los del barrio"), anyInt(), org.mockito.ArgumentMatchers.anyLong());
        verify(sender, never()).send(eq("https://fcm.googleapis.com/fcm/send/newcomer"), anyString(), anyString(),
                anyString(), anyInt(), org.mockito.ArgumentMatchers.anyLong());
    }

    @ParameterizedTest
    @CsvSource({"POOL, /?group=", "TOURNAMENT, /torneos/"})
    void promotionNotifiesOnlyTheNewAdminWithALinkToTheLeague(String kind, String path) {
        when(sender.isEnabled()).thenReturn(true);
        UserAccount owner = userAccountRepository.save(UserAccount.builder()
                .googleEmail("owner-" + kind + "@test.invalid").googleName("Owner").participantName("Owner").build());
        UserAccount member = userAccountRepository.save(UserAccount.builder()
                .googleEmail("member-" + kind + "@test.invalid").googleName("Ana").participantName("Ana")
                .memberJoinedAlertsEnabled(false).build());
        League league = leagueRepository.save(League.builder().name("Los del sábado").joinCode("A" + kind.substring(0, 4))
                .kind(kind).adminUser(owner).build());
        Membership.MembershipId membershipId = new Membership.MembershipId(member.getId(), league.getId());
        membershipRepository.save(Membership.builder().id(membershipId).user(member).league(league).role("MEMBER").build());
        String ownerEndpoint = "https://fcm.googleapis.com/fcm/send/owner-" + kind;
        String memberEndpoint = "https://fcm.googleapis.com/fcm/send/member-" + kind;
        subscriptionRepository.save(PushSubscription.builder().user(owner).endpoint(ownerEndpoint).p256dh("p").auth("a").build());
        subscriptionRepository.save(PushSubscription.builder().user(member).endpoint(memberEndpoint).p256dh("p").auth("a").build());

        membershipService.setRole(league.getId(), member.getId(), owner.getGoogleEmail(), "ADMIN");

        assertThat(membershipRepository.findById(membershipId).orElseThrow().getRole()).isEqualTo("ADMIN");
        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(sender, timeout(10_000)).send(eq(memberEndpoint), anyString(), anyString(), payload.capture(),
                anyInt(), eq(member.getId()));
        assertThat(payload.getValue()).contains("Ahora puedes administrar «Los del sábado».",
                "\"url\":\"" + path + league.getId() + "\"");
        verify(sender, never()).send(eq(ownerEndpoint), anyString(), anyString(), anyString(), anyInt(), eq(owner.getId()));
    }
}
