package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.model.League;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.admin.AdminService;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Las cifras y listados del panel de administración, con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=admin-service-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class AdminServiceIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private AdminService adminService;
    @Autowired private LeagueService leagueService;
    @Autowired private LeagueMembershipService membershipService;
    @Autowired private UserAccountRepository users;

    @Test
    void overviewCountsAccountsLeaguesAndMembers() {
        String key = UUID.randomUUID().toString().substring(0, 8);
        UserAccount owner = users.save(UserAccount.builder().googleEmail("owner-" + key + "@test.invalid")
                .googleSub("sub-" + key).participantName("Dueño " + key).build());
        UserAccount guest = users.save(UserAccount.builder().googleEmail("guest-" + key + "@test.invalid")
                .passwordHash("hash").participantName("Invitado " + key).build());
        League league = leagueService.createLeague(NewLeague.custom("Liga " + key, owner.getGoogleEmail(),
                "Torneo " + key, PoolFormat.MATCH_DAY).withPichichi(false));
        membershipService.join(league.getId(), guest.getGoogleEmail());

        AdminOverviewDTO overview = adminService.overview();

        assertThat(overview.totals().users()).isGreaterThanOrEqualTo(2);
        assertThat(overview.totals().newUsers24h()).isGreaterThanOrEqualTo(2);
        assertThat(overview.totals().leagues()).isGreaterThanOrEqualTo(1);
        assertThat(overview.totals().leaguesByKind()).containsKey("POOL");
        assertThat(overview.signupsByDay()).hasSize(30);
        assertThat(overview.signupsByDay().get(29).count()).isGreaterThanOrEqualTo(2);
        assertThat(overview.recentUsers())
                .filteredOn(u -> u.email().endsWith(key + "@test.invalid"))
                .extracting(AdminOverviewDTO.UserRow::method)
                .containsExactlyInAnyOrder("google", "email");
        assertThat(overview.recentUsers()).noneMatch(u -> UserAccount.SYSTEM_ADMIN_EMAIL.equals(u.email()));
        assertThat(overview.leagues())
                .filteredOn(l -> l.id().equals(league.getId()))
                .singleElement()
                .satisfies(l -> {
                    assertThat(l.members()).isEqualTo(2);
                    assertThat(l.owner()).isEqualTo("Dueño " + key);
                });
    }
}
