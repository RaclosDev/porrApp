package com.porra.mundial;

import com.porra.mundial.config.DataInitializer;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.league.LeagueService;
import com.porra.mundial.service.league.LeagueMembershipService;
import com.porra.mundial.service.league.NewLeague;
import com.porra.mundial.service.sync.SyncService;
import com.porra.mundial.service.tournament.TopScorerService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Matriz de acceso a una liga privada con la aplicación entera y Postgres real: cada lectura y cada
 * escritura de la liga se prueba sin sesión, con un usuario ajeno a la liga y con un miembro que no es
 * administrador. Un endpoint nuevo que se olvide de comprobar la pertenencia debe romper este test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=access-matrix-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LeagueAccessMatrixIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private LeagueService leagueService;
    @Autowired private LeagueMembershipService membershipService;
    @Autowired private UserAccountRepository users;
    @Autowired private JwtUtil jwtUtil;

    @LocalServerPort private int port;

    private long leagueId;
    private long adminId;
    private String memberToken;
    private String outsiderToken;

    @BeforeAll
    void createPrivateLeague() {
        UserAccount admin = user("admin-matrix@test.invalid", "Admin");
        UserAccount member = user("member-matrix@test.invalid", "Miembro");
        UserAccount outsider = user("outsider-matrix@test.invalid", "Ajeno");
        League league = leagueService.createLeague(NewLeague.custom("Liga privada", admin.getGoogleEmail(),
                "Torneo de prueba", PoolFormat.MATCH_DAY).withPichichi(false));
        membershipService.join(league.getId(), member.getGoogleEmail());

        leagueId = league.getId();
        adminId = admin.getId();
        memberToken = jwtUtil.generateAccessToken(member.getId(), member.getGoogleEmail());
        outsiderToken = jwtUtil.generateAccessToken(outsider.getId(), outsider.getGoogleEmail());
    }

    /** Lecturas con datos de la liga: solo para sus miembros. */
    private List<String> memberReads() {
        return List.of(
                "/api/groups/" + leagueId + "/members",
                "/api/groups/" + leagueId + "/scoring",
                "/api/groups/" + leagueId + "/competition/teams",
                "/api/groups/" + leagueId + "/competition/matches",
                "/api/groups/" + leagueId + "/competition/standings",
                "/api/groups/" + leagueId + "/competition/lock-state",
                "/api/leaderboard?groupId=" + leagueId,
                "/api/leaderboard/logs?groupId=" + leagueId,
                "/api/leaderboard/matchdays?groupId=" + leagueId,
                "/api/predictions?groupId=" + leagueId,
                "/api/predictions/matchday?groupId=" + leagueId,
                "/api/predictions/matchday/stats?groupId=" + leagueId);
    }

    /** Cambios que solo puede hacer el administrador de la liga. */
    private List<HttpRequest.Builder> adminWrites() {
        String base = "/api/groups/" + leagueId;
        String json = "application/json";
        return List.of(
                request(base).PUT(HttpRequest.BodyPublishers.ofString("{\"name\":\"Cambiada\"}")).header("Content-Type", json),
                request(base).DELETE(),
                request(base + "/regenerate-code").POST(HttpRequest.BodyPublishers.noBody()),
                request(base + "/scoring").PUT(HttpRequest.BodyPublishers.ofString("{}")).header("Content-Type", json),
                request(base + "/members/" + adminId).DELETE(),
                request(base + "/members/" + adminId + "/payment")
                        .PUT(HttpRequest.BodyPublishers.ofString("{\"status\":\"PAID\"}")).header("Content-Type", json),
                request(base + "/members/" + adminId + "/admin").PUT(HttpRequest.BodyPublishers.noBody()),
                request(base + "/image").DELETE());
    }

    @Test
    void anonymousVisitorsCannotReadPrivateLeagueData() throws Exception {
        List<String> leaks = new ArrayList<>();
        for (String path : memberReads()) {
            int status = send(request(path).GET(), null).statusCode();
            if (status < 400) leaks.add(path + " → " + status);
        }
        assertThat(leaks).as("lecturas abiertas sin sesión").isEmpty();
    }

    @Test
    void usersOutsideTheLeagueCannotReadItsData() throws Exception {
        List<String> leaks = new ArrayList<>();
        for (String path : memberReads()) {
            HttpResponse<String> response = send(request(path).GET(), outsiderToken);
            if (response.statusCode() < 400) leaks.add(path + " → " + response.statusCode() + " " + response.body());
        }
        assertThat(leaks).as("lecturas abiertas a un usuario ajeno a la liga").isEmpty();
    }

    @Test
    void membersCanReadTheirLeague() throws Exception {
        List<String> failures = new ArrayList<>();
        for (String path : memberReads()) {
            int status = send(request(path).GET(), memberToken).statusCode();
            if (status != 200) failures.add(path + " → " + status);
        }
        assertThat(failures).as("lecturas que fallan a un miembro").isEmpty();
    }

    @Test
    void onlyTheAdminCanChangeTheLeague() throws Exception {
        List<String> allowed = new ArrayList<>();
        for (String token : List.of(outsiderToken, memberToken)) {
            for (HttpRequest.Builder write : adminWrites()) {
                HttpRequest built = write.build();
                int status = send(write, token).statusCode();
                if (status < 400) allowed.add(built.method() + " " + built.uri().getPath() + " → " + status);
            }
        }
        assertThat(allowed).as("cambios permitidos a quien no administra la liga").isEmpty();
    }

    private UserAccount user(String email, String name) {
        return users.save(UserAccount.builder().googleEmail(email).googleName(name).participantName(name).build());
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private HttpResponse<String> send(HttpRequest.Builder request, String token) throws Exception {
        HttpRequest.Builder copy = request.copy();
        if (token != null) copy.header("Authorization", "Bearer " + token);
        return HTTP.send(copy.build(), HttpResponse.BodyHandlers.ofString());
    }
}
