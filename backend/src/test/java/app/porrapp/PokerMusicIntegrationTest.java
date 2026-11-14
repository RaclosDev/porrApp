package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.config.JwtUtil;
import app.porrapp.dto.PokerDTO.AddTrack;
import app.porrapp.dto.PokerDTO.CreateLeague;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = {"app.jwt.secret=poker-music-test-secret-0123456789-abcdefghijklmnop", "app.youtube.demo=true"})
@Testcontainers(disabledWithoutDocker = true)
class PokerMusicIntegrationTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean DataInitializer dataInitializer;
    @MockitoBean SyncService syncService;
    @MockitoBean TopScorerService topScorerService;
    @Autowired UserAccountRepository users;
    @Autowired LeagueMembershipService memberships;
    @Autowired JwtUtil jwt;
    @LocalServerPort int port;
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void membersRequestSongsWithLimitsAndOnlyTheirOwnCanBeRemoved() throws Exception {
        var owner = user("Anfitrión");
        var guest = user("Invitado");
        var outsider = user("Ajeno");
        long id = json.readTree(send("POST", "/api/poker", owner, new CreateLeague("Música", UUID.randomUUID()))
                .body()).get("id").asLong();
        memberships.join(id, guest.getGoogleEmail());
        String music = "/api/poker/" + id + "/music";

        assertThat(send("GET", music, outsider, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", music + "/search?q=queen", outsider, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", music + "/search?q=a", guest, null).statusCode()).isEqualTo(400);
        JsonNode found = json.readTree(send("GET", music + "/search?q=queen", guest, null).body());
        assertThat(found.get("available").asBoolean()).isTrue();
        assertThat(found.get("results").get(0).get("videoId").asText()).isEqualTo("fJ9rUzIMcZQ");
        String link = java.net.URLEncoder.encode("https://youtu.be/dQw4w9WgXcQ?si=abc", java.nio.charset.StandardCharsets.UTF_8);
        JsonNode byLink = json.readTree(send("GET", music + "/search?q=" + link, guest, null).body());
        assertThat(byLink.get("results")).hasSize(1);
        assertThat(byLink.get("results").get(0).get("videoId").asText()).isEqualTo("dQw4w9WgXcQ");

        assertThat(send("POST", music, guest, new AddTrack("no es valido!", "Mala", "")).statusCode())
                .isEqualTo(400);
        assertThat(send("POST", music, outsider, new AddTrack("fJ9rUzIMcZQ", "Bohemian", "Queen")).statusCode())
                .isEqualTo(404);
        var added = send("POST", music, guest, new AddTrack("fJ9rUzIMcZQ", "Bohemian", "Queen"));
        assertThat(added.statusCode()).isEqualTo(201);
        long itemId = json.readTree(added.body()).get("items").get(0).get("id").asLong();
        assertThat(send("POST", music, owner, new AddTrack("fJ9rUzIMcZQ", "Bohemian", "Queen")).statusCode())
                .isEqualTo(409);

        assertThat(send("POST", music, guest, new AddTrack("dQw4w9WgXcQ", "Rick", "")).statusCode()).isEqualTo(201);
        assertThat(send("POST", music, guest, new AddTrack("kJQP7kiw5Fk", "Despacito", "")).statusCode())
                .isEqualTo(201);
        assertThat(send("POST", music, guest, new AddTrack("JGwWNGJdvx8", "Shape", "")).statusCode()).isEqualTo(409);
        assertThat(send("POST", music, owner, new AddTrack("JGwWNGJdvx8", "Shape", "")).statusCode()).isEqualTo(201);

        JsonNode asGuest = json.readTree(send("GET", music, guest, null).body());
        assertThat(asGuest.get("items")).hasSize(4);
        assertThat(asGuest.get("items").get(0).get("addedBy").asText()).isNotBlank();
        assertThat(asGuest.get("items").get(3).get("removable").asBoolean()).isFalse();
        assertThat(asGuest.get("organizer").asBoolean()).isFalse();

        long ownersItem = asGuest.get("items").get(3).get("id").asLong();
        assertThat(send("DELETE", music + "/" + ownersItem, guest, null).statusCode()).isEqualTo(403);
        assertThat(send("DELETE", music + "/" + itemId, guest, null).statusCode()).isEqualTo(200);
        assertThat(send("DELETE", music + "/" + ownersItem, owner, null).statusCode()).isEqualTo(200);
        // Quitar algo que ya no está no es un error: dos pantallas pueden pasar de canción a la vez.
        assertThat(send("DELETE", music + "/" + itemId, owner, null).statusCode()).isEqualTo(200);
        // La que suena la puede pasar cualquier miembro (la tele puede ser la de cualquiera).
        JsonNode rest = json.readTree(send("GET", music, owner, null).body());
        assertThat(rest.get("items")).hasSize(2);
        assertThat(send("DELETE", music + "/" + rest.get("items").get(0).get("id").asLong(), guest, null)
                .statusCode()).isEqualTo(200);
        assertThat(json.readTree(send("GET", music, owner, null).body()).get("items")).hasSize(1);
    }

    private UserAccount user(String label) {
        return users.save(UserAccount.builder().googleEmail(UUID.randomUUID() + "@test.invalid")
                .googleName(label).participantName(label).build());
    }

    private HttpResponse<String> send(String method, String path, UserAccount user, Object body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        request.header("Authorization", "Bearer " + jwt.generateAccessToken(user.getId(), user.getGoogleEmail()));
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
