
package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.config.JwtUtil;
import app.porrapp.dto.PokerDTO.*;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.league.PokerLeagueService;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import tools.jackson.databind.ObjectMapper;
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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=poker-league-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class PokerLeagueIntegrationTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    @MockitoBean DataInitializer dataInitializer;
    @MockitoBean SyncService syncService;
    @MockitoBean TopScorerService topScorerService;
    @Autowired UserAccountRepository users;
    @Autowired LeagueMembershipService memberships;
    @Autowired PokerLeagueService service;
    @Autowired JwtUtil jwt;
    @LocalServerPort int port;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void creatorDelegatesWithoutLosingControlAndRevocationTakesEffect() throws Exception {
        var creator = user("Creador");
        var admin = user("Admin");
        var second = user("Segundo");
        var organizer = user("Organizador");
        var outsider = user("Ajeno");
        var league = decode(send("POST", "/api/poker", creator,
                new CreateLeague("Liga con equipo", UUID.randomUUID())), 201);
        String group = "/api/groups/" + league.id();
        String poker = "/api/poker/" + league.id();
        for (var member : List.of(admin, second, organizer)) memberships.join(league.id(), member.getGoogleEmail());

        assertThat(send("PUT", group + "/members/" + admin.getId() + "/role", outsider,
                java.util.Map.of("role", "ADMIN")).statusCode()).isEqualTo(403);
        for (var member : List.of(admin, second)) {
            assertThat(send("PUT", group + "/members/" + member.getId() + "/role", creator,
                    java.util.Map.of("role", "ADMIN")).statusCode()).isEqualTo(200);
        }
        assertThat(send("PUT", group + "/members/" + organizer.getId() + "/role", creator,
                java.util.Map.of("role", "ORGANIZER")).statusCode()).isEqualTo(200);
        var members = json.readTree(send("GET", group + "/members", creator, null).body());
        assertThat(members.findValuesAsString("role")).contains("ADMIN", "ORGANIZER");
        assertThat(decode(send("GET", poker, creator, null), 200).owner()).isTrue();
        assertThat(decode(send("GET", poker, admin, null), 200).owner()).isTrue();
        assertThat(decode(send("GET", poker, organizer, null), 200).owner()).isTrue();
        assertThat(send("PUT", group + "/members/" + creator.getId() + "/role", creator,
                java.util.Map.of("role", "MEMBER")).statusCode()).isEqualTo(400);
        assertThat(send("PUT", group + "/members/" + second.getId() + "/role", admin,
                java.util.Map.of("role", "MEMBER")).statusCode()).isEqualTo(403);
        assertThat(send("DELETE", group + "/members/" + creator.getId(), admin, null).statusCode()).isEqualTo(400);
        assertThat(send("DELETE", group + "/members/" + second.getId(), admin, null).statusCode()).isEqualTo(403);
        assertThat(send("DELETE", group, admin, null).statusCode()).isEqualTo(403);
        assertThat(send("DELETE", group, organizer, null).statusCode()).isEqualTo(403);

        var settings = new Settings(1000, 10000, null, null, List.of(100),
                List.of(new BlindLevel(15, 25, 50, 0)));
        assertThat(send("POST", poker + "/sessions", organizer,
                new CreateSession(LocalDate.of(2026, 11, 21), settings)).statusCode()).isEqualTo(201);
        assertThat(send("PUT", group + "/members/" + organizer.getId() + "/role", creator,
                java.util.Map.of("role", "MEMBER")).statusCode()).isEqualTo(200);
        assertThat(decode(send("GET", poker, organizer, null), 200).owner()).isFalse();
        assertThat(send("POST", poker + "/sessions", organizer,
                new CreateSession(LocalDate.of(2026, 11, 28), settings)).statusCode()).isEqualTo(403);
        assertThat(send("PUT", group + "/members/" + admin.getId() + "/role", creator,
                java.util.Map.of("role", "MEMBER")).statusCode()).isEqualTo(200);
        assertThat(decode(send("GET", poker, admin, null), 200).owner()).isFalse();
        assertThat(decode(send("GET", poker, second, null), 200).owner()).isTrue();
    }

    @Test
    void severalScheduledTournamentsCanBeJoinedSeparately() throws Exception {
        var organizer = user("Ana");
        var member = user("Luis");
        var league = decode(send("POST", "/api/poker", organizer,
                new CreateLeague("Póker de entre semana", UUID.randomUUID())), 201);
        String path = "/api/poker/" + league.id();
        memberships.join(league.id(), member.getGoogleEmail());
        var settings = new Settings(1000, 10000, null, null, List.of(100), List.of(new BlindLevel(15, 25, 50, 0)));
        var saturday = decode(send("POST", path + "/sessions", organizer,
                new CreateSession(LocalDate.of(2026, 11, 28), settings)), 201).current();
        var both = decode(send("POST", path + "/sessions", organizer,
                new CreateSession(LocalDate.of(2026, 11, 25), settings)), 201);
        assertThat(both.upcoming()).extracting(Session::date)
                .containsExactly(LocalDate.of(2026, 11, 25), LocalDate.of(2026, 11, 28));
        var wednesday = both.current();
        assertThat(wednesday.date()).isEqualTo(LocalDate.of(2026, 11, 25));

        decode(send("PUT", path + "/sessions/" + saturday.id() + "/attendance", organizer,
                new Attendance(null, true)), 200);
        var joined = decode(send("PUT", path + "/sessions/" + saturday.id() + "/attendance", member,
                new Attendance(null, true)), 200);
        assertThat(joined.upcoming()).extracting(session -> session.entries().size()).containsExactly(0, 2);

        // El que está en juego va primero aunque haya otro programado antes.
        var started = decode(send("POST", path + "/sessions/" + saturday.id() + "/commands", organizer,
                new Command(Action.START, joined.upcoming().get(1).revision(), null)), 200);
        assertThat(started.current().id()).isEqualTo(saturday.id());
        assertThat(started.upcoming()).extracting(Session::id).containsExactly(saturday.id(), wednesday.id());

        var cancelled = decode(send("POST", path + "/sessions/" + wednesday.id() + "/commands", organizer,
                new Command(Action.CANCEL, wednesday.revision(), null)), 200);
        assertThat(cancelled.upcoming()).extracting(Session::id).containsExactly(saturday.id());

        for (int week = 1; week < 5; week++) {
            decode(send("POST", path + "/sessions", organizer,
                    new CreateSession(LocalDate.of(2026, 11, 28).plusWeeks(week), settings)), 201);
        }
        assertThat(send("POST", path + "/sessions", organizer,
                new CreateSession(LocalDate.of(2027, 1, 30), settings)).statusCode()).isEqualTo(409);
    }

    @Test
    void latecomersCanJoinAStartedTableButNobodyLeavesIt() throws Exception {
        var organizer = user("Ana");
        var member = user("Luis");
        var league = decode(send("POST", "/api/poker", organizer,
                new CreateLeague("Póker de los viernes", UUID.randomUUID())), 201);
        String path = "/api/poker/" + league.id();
        memberships.join(league.id(), member.getGoogleEmail());
        var settings = new Settings(1000, 10000, null, null, List.of(100), List.of(new BlindLevel(15, 25, 50, 0)));
        var current = decode(send("POST", path + "/sessions", organizer,
                new CreateSession(LocalDate.of(2026, 11, 20), settings)), 201).current();
        String tournament = path + "/sessions/" + current.id();
        decode(send("PUT", tournament + "/attendance", organizer, new Attendance(null, true)), 200);
        var ready = decode(send("POST", tournament + "/guests", organizer, new Guest("Marta")), 201).current();
        var playing = command(tournament, organizer, ready, Action.START, null);
        assertThat(playing.potCents()).isEqualTo(2000);

        var late = decode(send("PUT", tournament + "/attendance", member, new Attendance(null, true)), 200).current();
        assertThat(late.entries()).hasSize(3);
        assertThat(late.potCents()).isEqualTo(3000);
        var withGuest = decode(send("POST", tournament + "/guests", organizer, new Guest("Paz")), 201).current();
        assertThat(withGuest.entries()).hasSize(4);
        assertThat(send("POST", tournament + "/guests", member, new Guest("Bea")).statusCode()).isEqualTo(403);
        assertThat(send("PUT", tournament + "/attendance", member, new Attendance(null, false))
                .statusCode()).isEqualTo(409);
    }

    @Test
    void membersAndGuestsCanPlayAgainWithOneHistoryAndCorrectPayouts() throws Exception {
        var organizer = user("Ana");
        var member = user("Luis");
        var outsider = user("Bea");
        var creation = new CreateLeague("Póker de los sábados", UUID.randomUUID());
        var league = decode(send("POST", "/api/poker", organizer, creation), 201);
        assertThat(service.create(organizer.getGoogleEmail(), creation).id()).isEqualTo(league.id());
        String path = "/api/poker/" + league.id();
        assertThat(send("GET", path, outsider, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", path, null, null).statusCode()).isEqualTo(401);

        memberships.join(league.id(), member.getGoogleEmail());
        var memberView = decode(send("GET", path, member, null), 200);
        long memberId = memberView.myPlayerId();
        assertThat(memberView.players()).hasSize(2);
        assertThat(memberView.players()).extracting(Player::userId)
                .containsExactlyInAnyOrder(organizer.getId(), member.getId());
        assertThat(memberView.players()).extracting(Player::avatarUrl).containsOnlyNulls();

        var levels = List.of(new BlindLevel(15, 25, 50, 0), new BlindLevel(10, 0, 0, 0),
                new BlindLevel(15, 50, 100, 10));
        var settings = new Settings(1001, 10000, new Extra(500, 10000, 1, 1),
                new Extra(250, 5000, 1, 2), List.of(65, 35), levels);
        var saturday = LocalDate.of(2026, 11, 14);
        var schedule = new CreateSession(saturday, settings);
        assertThat(send("POST", path + "/sessions", member, schedule).statusCode()).isEqualTo(403);
        var current = decode(send("POST", path + "/sessions", organizer, schedule), 201).current();
        String tournament = path + "/sessions/" + current.id();
        assertThat(send("PUT", tournament + "/attendance", member, new Attendance(league.myPlayerId(), true))
                .statusCode()).isEqualTo(403);
        decode(send("PUT", tournament + "/attendance", member, new Attendance(null, true)), 200);
        decode(send("PUT", tournament + "/attendance", organizer, new Attendance(null, true)), 200);
        var withGuest = decode(send("POST", tournament + "/guests", organizer, new Guest(" Marta ")), 201);
        assertThat(withGuest.current().entries()).hasSize(3);
        long guestId = withGuest.players().stream().filter(Player::guest).findFirst().orElseThrow().id();
        assertThat(withGuest.current().entries()).anyMatch(entry -> entry.playerId() == guestId && entry.name().equals("Marta"));
        assertThat(send("POST", tournament + "/guests", organizer, new Guest("marta")).statusCode()).isEqualTo(409);

        var playing = command(tournament, organizer, withGuest.current(), Action.START, null);
        assertThat(playing.clock().level()).isZero();
        assertThat(send("PUT", tournament + "/attendance", member, new Attendance(null, false))
                .statusCode()).isEqualTo(409);
        assertThat(send("POST", tournament + "/commands", member, new Command(Action.PAUSE, playing.revision(), null))
                .statusCode()).isEqualTo(403);
        assertThat(send("POST", tournament + "/commands", organizer, new Command(Action.CLOSE, playing.revision(), null))
                .statusCode()).isEqualTo(409);
        var paused = command(tournament, organizer, playing, Action.PAUSE, null);
        assertThat(paused.clock().endsAt()).isNull();
        assertThat(send("POST", tournament + "/commands", organizer, new Command(Action.NEXT_LEVEL, playing.revision(), null))
                .statusCode()).isEqualTo(409);
        // Cualquier jugador apunta recompras, add-ons y eliminaciones; el reloj sigue siendo del organizador.
        var rebought = command(tournament, member, paused, Action.REBUY, memberId);
        assertThat(rebought.potCents()).isEqualTo(3503);
        var corrected = command(tournament, member, rebought, Action.UNDO_REBUY, memberId);
        assertThat(corrected.potCents()).isEqualTo(3003);
        rebought = command(tournament, organizer, corrected, Action.REBUY, memberId);
        var breakLevel = command(tournament, organizer, rebought, Action.NEXT_LEVEL, null);
        assertThat(breakLevel.clock().level()).isEqualTo(1);
        assertThat(breakLevel.clock().endsAt()).isNull();
        // El descanso que sigue al corte de recompras aún deja recomprar.
        var boughtOnBreak = command(tournament, organizer, breakLevel, Action.REBUY, guestId);
        breakLevel = command(tournament, organizer, boughtOnBreak, Action.UNDO_REBUY, guestId);
        var withAddOn = command(tournament, organizer, breakLevel, Action.ADD_ON, guestId);
        var eliminated = command(tournament, member, withAddOn, Action.ELIMINATE, memberId);
        var restored = command(tournament, organizer, eliminated, Action.UNDO_ELIMINATION, null);
        assertThat(restored.eliminations()).isEmpty();
        eliminated = command(tournament, organizer, restored, Action.ELIMINATE, guestId);
        eliminated = command(tournament, organizer, eliminated, Action.ELIMINATE, memberId);
        var closed = decode(send("POST", tournament + "/commands", organizer,
                new Command(Action.CLOSE, eliminated.revision(), null)), 200);
        assertThat(closed.current()).isNull();

        var history = service.history(member.getGoogleEmail(), league.id());
        assertThat(history).hasSize(1);
        var finished = history.getFirst();
        assertThat(finished.potCents()).isEqualTo(3753);
        assertThat(finished.prizes()).containsExactly(2440L, 1313L);
        assertThat(finished.results()).extracting(Result::playerId).containsExactly(league.myPlayerId(), memberId, guestId);
        assertThat(finished.results()).extracting(Result::paidCents).containsExactly(1001L, 1501L, 1251L);
        assertThat(finished.results()).extracting(Result::prizeCents).containsExactly(2440L, 1313L, 0L);
        assertThat(send("GET", path + "/history", outsider, null).statusCode()).isEqualTo(404);

        var next = decode(send("POST", path + "/sessions", organizer,
                new CreateSession(saturday.plusWeeks(1), settings)), 201);
        assertThat(next.current().entries()).isEmpty();
        assertThat(next.players()).extracting(Player::id).contains(memberId, guestId);
        decode(send("PUT", path + "/sessions/" + next.current().id() + "/attendance", member,
                new Attendance(null, true)), 200);
        assertThat(service.history(member.getGoogleEmail(), league.id())).containsExactly(finished);

        // Solo la administración corrige o borra el histórico; un torneo abierto no se toca desde ahí.
        String closedPath = path + "/history/" + finished.id();
        var edit = new EditResults(saturday.minusDays(1), finished.revision(), List.of(
                new ResultEdit(memberId, 0, 0), new ResultEdit(guestId, 0, 1),
                new ResultEdit(league.myPlayerId(), 0, 0)));
        assertThat(send("PUT", closedPath, member, edit).statusCode()).isEqualTo(403);
        assertThat(send("DELETE", closedPath, member, null).statusCode()).isEqualTo(403);
        assertThat(send("DELETE", path + "/history/" + next.current().id(), organizer, null).statusCode())
                .isEqualTo(409);
        assertThat(send("PUT", closedPath, organizer, new EditResults(saturday, finished.revision(),
                List.of(new ResultEdit(memberId, 0, 0)))).statusCode()).isEqualTo(400);
        var edited = history(send("PUT", closedPath, organizer, edit)).getFirst();
        assertThat(edited.date()).isEqualTo(saturday.minusDays(1));
        assertThat(edited.potCents()).isEqualTo(3253);
        assertThat(edited.results()).extracting(Result::playerId).containsExactly(memberId, guestId, league.myPlayerId());
        assertThat(edited.results()).extracting(Result::prizeCents).containsExactly(2115L, 1138L, 0L);
        assertThat(send("PUT", closedPath, organizer, edit).statusCode()).isEqualTo(409);
        assertThat(history(send("DELETE", closedPath, organizer, null))).isEmpty();
    }

    private List<Session> history(HttpResponse<String> response) throws Exception {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return List.of(json.readValue(response.body(), Session[].class));
    }

    private Session command(String tournament, UserAccount owner, Session current, Action action, Long player) throws Exception {
        return decode(send("POST", tournament + "/commands", owner, new Command(action, current.revision(), player)), 200)
                .current();
    }

    private LeagueView decode(HttpResponse<String> response, int status) throws Exception {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        return json.readValue(response.body(), LeagueView.class);
    }

    private UserAccount user(String label) {
        return users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid")
                .googleName(label).participantName(label).build());
    }

    private HttpResponse<String> send(String method, String path, UserAccount user, Object body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (user != null) {
            request.header("Authorization", "Bearer " + jwt.generateAccessToken(user.getId(), user.getGoogleEmail()));
        }
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private record Guest(String name) {
    }
}
