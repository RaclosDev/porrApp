package app.porrapp;

import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.model.League;
import app.porrapp.model.UserAccount;
import app.porrapp.model.Membership;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Arranca la aplicación entera con el application.properties real (el de src/test/resources
 * lo sustituye en el resto de tests) contra un Postgres de verdad, como en producción.
 * Detecta propiedades que ya no existen, beans que faltan y migraciones que no aplican.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(
        locations = "file:src/main/resources/application.properties",
        properties = {"app.jwt.secret=context-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
                "app.metrics.token=" + PorrAppApplicationTests.METRICS_TOKEN})
@Testcontainers(disabledWithoutDocker = true)
class PorrAppApplicationTests {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    static final String METRICS_TOKEN = "context-test-metrics-token";

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    @Autowired
    private LeagueRepository leagues;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private MembershipRepository memberships;

    // El arranque conserva PostgreSQL y HTTP reales, pero no depende del calendario vivo de ESPN.
    @MockitoBean
    private SyncService syncService;

    @MockitoBean
    private TopScorerService topScorerService;

    private HttpResponse<String> get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
        return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void startsAndAnswersTheLivenessProbe() throws Exception {
        HttpResponse<String> response = get("/actuator/health/liveness");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("UP");
    }

    @Test
    @Sql("/legacy-laliga-fixtures.sql")
    void servesPublicJsonWithIsoDates() throws Exception {
        HttpResponse<String> response = get("/api/matches?competitionId=2");

        assertThat(response.statusCode()).isEqualTo(200);
        // Las fechas salen como texto ISO con su desfase, no como números, arrays ni hora sin zona.
        assertThat(response.body()).containsPattern("\"date\":\"\\d{4}-\\d{2}-\\d{2}T[\\d:.]+[+-]\\d{2}:\\d{2}\"");
    }

    @Test
    void exposesPrometheusMetricsOnlyWithTheToken() throws Exception {
        assertThat(get("/actuator/prometheus").statusCode()).isEqualTo(401);

        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/actuator/prometheus"))
                .header("Authorization", "Bearer " + METRICS_TOKEN).GET().build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("hikaricp_connections_active", "porra_websocket_sessions");
    }
}
