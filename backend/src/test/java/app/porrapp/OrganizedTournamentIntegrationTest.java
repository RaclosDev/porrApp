package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.config.JwtUtil;
import app.porrapp.dto.OrganizedTournamentDTO;
import app.porrapp.dto.OrganizedTournamentDTO.*;
import app.porrapp.model.Membership;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.*;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.OrganizedTournamentService;
import app.porrapp.service.tournament.TopScorerService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
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
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=organized-tournament-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class OrganizedTournamentIntegrationTest {
    @Container @ServiceConnection static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    @MockitoBean DataInitializer dataInitializer;
    @MockitoBean TopScorerService topScorerService;
    @MockitoBean SyncService syncService;
    @Autowired OrganizedTournamentService service;
    @Autowired UserAccountRepository users;
    @Autowired LeagueRepository leagues;
    @Autowired MembershipRepository tournamentMemberships;
    @Autowired TournamentResultChangeRepository changes;
    @Autowired JwtUtil jwt;
    @LocalServerPort int port;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void creatorCanFindAndOpenTheTournamentWithoutAMembershipRow() throws Exception {
        UserAccount owner = user("owner"), outsider = user("outsider");
        OrganizedTournamentDTO tournament = service.create(owner.getGoogleEmail(),
                new Create("Torneo en borrador", "Póker", "INDIVIDUAL", UUID.randomUUID()));
        tournamentMemberships.deleteById(new Membership.MembershipId(owner.getId(), tournament.id()));

        HttpResponse<String> mine = send("GET", "/api/groups/mine", owner, null);
        assertThat(mine.statusCode()).isEqualTo(200);
        assertThat(json.readTree(mine.body()).findValuesAsText("id")).contains(tournament.id().toString());
        assertThat(send("GET", "/api/tournaments/" + tournament.id(), owner, null).statusCode()).isEqualTo(200);
        HttpResponse<String> outsiderGroups = send("GET", "/api/groups/mine", outsider, null);
        assertThat(outsiderGroups.statusCode()).isEqualTo(200);
        assertThat(json.readTree(outsiderGroups.body()).findValuesAsText("id")).doesNotContain(tournament.id().toString());
    }

    @Test
    void publicViewIsOptInReadOnlyAndContainsNoAccountOrJoinData() throws Exception {
        UserAccount owner = user("owner"), outsider = user("outsider");
        Create create = new Create("Copa del pueblo", "Petanca", "PAIR", UUID.randomUUID());
        OrganizedTournamentDTO t = service.create(owner.getGoogleEmail(), create);
        assertThat(service.create(owner.getGoogleEmail(), create).id()).isEqualTo(t.id());
        Long id = t.id();
        String publicPath = "/api/tournaments/public/" + t.publicId();
        assertThat(send("GET", publicPath, null, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", "/api/tournaments/" + id, null, null).statusCode()).isEqualTo(401);
        assertThat(send("GET", "/api/tournaments/" + id, outsider, null).statusCode()).isEqualTo(403);
        assertThat(send("PUT", "/api/tournaments/" + id + "/publication", outsider, new Publication(0, true)).statusCode()).isEqualTo(403);
        assertThat(send("PUT", "/api/tournaments/" + id + "/publication", null, new Publication(0, true)).statusCode()).isEqualTo(401);
        t = service.addParticipant(owner.getGoogleEmail(), id, new ParticipantInput(t.revision(), "Pareja A"));
        t = service.addParticipant(owner.getGoogleEmail(), id, new ParticipantInput(t.revision(), "Pareja B"));
        t = service.generate(owner.getGoogleEmail(), id, new Schedule(t.revision(), "LEAGUE", "SEEDED", 1, 3, 1, 0));
        t = service.result(owner.getGoogleEmail(), id, t.matches().getFirst().id(), new Result(t.revision(), 13, 8, "HOME"));
        t = service.publish(owner.getGoogleEmail(), id, new Publication(t.revision(), true));
        HttpResponse<String> publicResponse = send("GET", publicPath, null, null);
        assertThat(publicResponse.statusCode()).isEqualTo(200);
        assertThat(publicResponse.headers().firstValue("Cache-Control")).contains("no-store");
        assertThat(publicResponse.body()).contains("Pareja A", "Pareja B", "Copa del pueblo")
                .doesNotContain(owner.getGoogleEmail(), outsider.getGoogleEmail(), "adminUser", "joinCode", "creationKey", "actorId");
        assertThat(send("GET", "/api/predictions?groupId=" + id, owner, null).statusCode()).isEqualTo(400);
        assertThat(changes.findAll().stream().filter(c -> c.getTournamentId().equals(id))).hasSize(1);
        assertThat(leagues.findById(id).orElseThrow().isPublicLeague()).isFalse();
        service.publish(owner.getGoogleEmail(), id, new Publication(t.revision(), false));
        assertThat(send("GET", publicPath, null, null).statusCode()).isEqualTo(404);
    }

    @Test
    void invitationGrantsReadOnlyAccessAndOwnerCanDeleteTheTournament() throws Exception {
        UserAccount owner = user("owner"), guest = user("guest");
        OrganizedTournamentDTO tournament = service.create(owner.getGoogleEmail(),
                new Create("Copa privada", "Póker", "INDIVIDUAL", UUID.randomUUID()));
        Long id = tournament.id();
        String code = leagues.findById(id).orElseThrow().getJoinCode();
        String detail = "/api/tournaments/" + id;
        String group = "/api/groups/" + id;
        String publicPath = "/api/tournaments/public/" + tournament.publicId();

        HttpResponse<String> preview = send("GET", "/api/groups/preview/" + code, null, null);
        assertThat(preview.statusCode()).isEqualTo(200);
        assertThat(json.readTree(preview.body()).path("kind").asText()).isEqualTo("TOURNAMENT");
        assertThat(send("GET", detail, guest, null).statusCode()).isEqualTo(403);
        assertThat(send("POST", "/api/groups/join", guest, Map.of("joinCode", code)).statusCode()).isEqualTo(200);

        HttpResponse<String> view = send("GET", detail, guest, null);
        assertThat(view.statusCode()).isEqualTo(200);
        assertThat(json.readTree(view.body()).path("canEdit").asBoolean()).isFalse();
        assertThat(json.readTree(view.body()).path("publicId").isNull()).isTrue();
        assertThat(json.readTree(send("GET", "/api/groups/mine", guest, null).body()).findValuesAsText("id"))
                .contains(id.toString());
        assertThat(send("GET", publicPath, null, null).statusCode()).isEqualTo(404);
        assertThat(send("POST", detail + "/participants", guest, new ParticipantInput(0, "Intruso")).statusCode())
                .isEqualTo(403);
        assertThat(send("DELETE", group, guest, null).statusCode()).isEqualTo(403);

        service.publish(owner.getGoogleEmail(), id, new Publication(0, true));
        assertThat(send("GET", publicPath, null, null).statusCode()).isEqualTo(200);
        assertThat(send("DELETE", group, owner, null).statusCode()).isEqualTo(200);
        assertThat(send("GET", detail, guest, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", publicPath, null, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", "/api/groups/preview/" + code, null, null).statusCode()).isEqualTo(404);
    }

    @Test
    void competingWritesAndCrossTournamentIdsCannotOverwriteState() throws Exception {
        UserAccount owner = user("concurrency");
        OrganizedTournamentDTO t = service.create(owner.getGoogleEmail(), new Create("Liga", "Fútbol", "TEAM", UUID.randomUUID()));
        Long id = t.id();
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Integer>> attempts = new ArrayList<>();
            for (String name : List.of("A", "B")) attempts.add(executor.submit(() -> {
                start.await();
                return send("POST", "/api/tournaments/" + id + "/participants", owner, new ParticipantInput(0, name)).statusCode();
            }));
            start.countDown();
            assertThat(List.of(attempts.get(0).get(), attempts.get(1).get())).containsExactlyInAnyOrder(200, 409);
        }
        t = service.get(owner.getGoogleEmail(), id);
        assertThat(t.participants()).hasSize(1);
        String foreignId = t.participants().getFirst().id();
        OrganizedTournamentDTO another = service.create(owner.getGoogleEmail(), new Create("Otra", "Cartas", "INDIVIDUAL", UUID.randomUUID()));
        assertThat(send("PUT", "/api/tournaments/" + another.id() + "/participants/" + foreignId, owner, new ParticipantInput(0, "Intruso")).statusCode()).isEqualTo(404);
        assertThat(service.get(owner.getGoogleEmail(), another.id()).revision()).isZero();
    }

    @Test
    void bracketEditsPreserveScheduleAndRejectChangesAfterPlay() throws Exception {
        UserAccount owner = user("bracket");
        String email = owner.getGoogleEmail();
        OrganizedTournamentDTO t = service.create(email, new Create("Copa", "Cartas", "INDIVIDUAL", UUID.randomUUID()));
        Long id = t.id();
        for (String name : List.of("A", "B", "C", "D")) t = service.addParticipant(email, id, new ParticipantInput(t.revision(), name));
        String a = t.participants().get(0).id(), d = t.participants().get(3).id();
        t = service.generate(email, id, new Schedule(t.revision(), "KNOCKOUT", "MANUAL", 1, 3, 1, 0));
        String semi = t.matches().getFirst().id();
        t = service.details(email, id, semi, new MatchDetails(t.revision(), java.time.Instant.parse("2026-12-01T17:00:00Z"), " Mesa 1 "));
        assertThat(send("PUT", "/api/tournaments/" + id + "/positions", owner, new Swap(t.revision(), a, d)).statusCode()).isEqualTo(200);
        t = service.get(email, id);
        assertThat(t.matches().getFirst().homeId()).isEqualTo(d);
        assertThat(t.matches().getFirst().venue()).isEqualTo("Mesa 1");
        assertThat(t.matches().getFirst().scheduledAt()).isEqualTo(java.time.Instant.parse("2026-12-01T17:00:00Z"));
        assertThat(send("PUT", "/api/tournaments/" + id + "/matches/" + semi + "/result", owner, new Result(t.revision(), 1, 1, null)).statusCode()).isEqualTo(400);
        t = service.result(email, id, semi, new Result(t.revision(), 1, 1, "HOME"));
        assertThat(t.matches().getLast().homeId()).isEqualTo(d);
        assertThat(send("PUT", "/api/tournaments/" + id + "/positions", owner, new Swap(t.revision(), a, d)).statusCode()).isEqualTo(409);
        t = service.result(email, id, t.matches().get(1).id(), new Result(t.revision(), null, null, "HOME"));
        String finalId = t.matches().getLast().id();
        t = service.result(email, id, finalId, new Result(t.revision(), 2, 0, null));
        long revision = t.revision();
        assertThat(send("PUT", "/api/tournaments/" + id + "/matches/" + semi + "/result", owner, new Result(revision, 0, 1, null)).statusCode()).isEqualTo(409);
        assertThat(service.get(email, id).revision()).isEqualTo(revision);
        assertThat(service.get(email, id).matches().getLast().homeId()).isEqualTo(d);
        t = service.result(email, id, finalId, new Result(revision, null, null, null));
        t = service.result(email, id, semi, new Result(t.revision(), 0, 1, null));
        assertThat(t.matches().getLast().homeId()).isEqualTo(t.participants().get(1).id());
    }

    @Test
    void participantAndManualScheduleLifecycleValidatesNamesScoresAndRegeneration() throws Exception {
        UserAccount owner = user("manual");
        String email = owner.getGoogleEmail();
        OrganizedTournamentDTO t = service.create(email, new Create("Liga", "Fútbol", "TEAM", UUID.randomUUID()));
        Long id = t.id();
        t = service.addParticipant(email, id, new ParticipantInput(0, "Equipo A"));
        String a = t.participants().getFirst().id();
        assertThat(send("POST", "/api/tournaments/" + id + "/participants", owner, new ParticipantInput(t.revision(), " equipo a ")).statusCode()).isEqualTo(400);
        t = service.addParticipant(email, id, new ParticipantInput(t.revision(), "B"));
        String b = t.participants().getLast().id();
        t = service.renameParticipant(email, id, b, new ParticipantInput(t.revision(), "Equipo B"));
        t = service.order(email, id, new Order(t.revision(), List.of(b, a)));
        assertThat(t.participants().getFirst().id()).isEqualTo(b);
        t = service.removeParticipant(email, id, a, t.revision());
        t = service.addParticipant(email, id, new ParticipantInput(t.revision(), "Equipo C"));
        String c = t.participants().getLast().id();
        t = service.addMatch(email, id, new MatchInput(t.revision(), 3, b, c, null, " Campo "));
        String match = t.matches().getFirst().id();
        assertThat(send("PUT", "/api/tournaments/" + id + "/matches/" + match + "/result", owner, new Result(t.revision(), 2, null, null)).statusCode()).isEqualTo(400);
        assertThat(send("PUT", "/api/tournaments/" + id + "/matches/" + match + "/result", owner, new Result(t.revision(), -1, 0, null)).statusCode()).isEqualTo(400);
        t = service.result(email, id, match, new Result(t.revision(), null, null, "DRAW"));
        assertThat(t.standings()).allMatch(s -> s.points() == 1);
        assertThat(send("DELETE", "/api/tournaments/" + id + "/schedule?revision=" + t.revision(), owner, null).statusCode()).isEqualTo(409);
        t = service.result(email, id, match, new Result(t.revision(), null, null, null));
        t = service.clearSchedule(email, id, t.revision());
        assertThat(t.matches()).isEmpty();
        t = service.generate(email, id, new Schedule(t.revision(), "LEAGUE", "SEEDED", 2, 2, 1, 0));
        assertThat(t.matches()).hasSize(2);
    }

    private UserAccount user(String prefix) {
        String unique = prefix + UUID.randomUUID();
        return users.save(UserAccount.builder().googleEmail(unique + "@test.invalid").googleName(prefix).participantName(unique).build());
    }
    private HttpResponse<String> send(String method, String path, UserAccount user, Object body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (user != null) request.header("Authorization", "Bearer " + jwt.generateAccessToken(user.getId(), user.getGoogleEmail()));
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
