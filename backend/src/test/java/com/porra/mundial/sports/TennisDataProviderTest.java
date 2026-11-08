package com.porra.mundial.sports;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TennisDataProviderTest {

    private static final String PARIS = "tennis.atp.13";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock
    private HttpClient httpClient;

    private final List<String> requested = new ArrayList<>();
    private TennisDataProvider provider;

    @BeforeEach
    void setUp() throws Exception {
        byte[] paris;
        try (var input = getClass().getResourceAsStream("/tennis/scoreboard-paris-2026.json")) {
            paris = Objects.requireNonNull(input).readAllBytes();
        }
        Map<String, byte[]> responses = Map.of(
                "/leagues/atp/events/13-2026", """
                        {"id": "13-2026", "date": "2026-10-31T04:00Z", "endDate": "2026-11-09T04:59Z"}
                        """.getBytes(StandardCharsets.UTF_8),
                "/atp/scoreboard?dates=20261031", paris);
        lenient().when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenAnswer(invocation -> {
            String url = invocation.<HttpRequest>getArgument(0).uri().toString();
            requested.add(url);
            @SuppressWarnings("unchecked")
            HttpResponse<byte[]> response = mock(HttpResponse.class);
            byte[] body = responses.entrySet().stream().filter(entry -> url.endsWith(entry.getKey()))
                    .map(Map.Entry::getValue).findFirst().orElse(null);
            when(response.statusCode()).thenReturn(body == null ? 404 : 200);
            lenient().when(response.body()).thenReturn(body == null ? new byte[0] : body);
            return response;
        });
        provider = new TennisDataProvider(httpClient, JSON, CircuitBreakerRegistry.ofDefaults(),
                Clock.fixed(Instant.parse("2026-11-07T12:00:00Z"), ZoneOffset.UTC));
    }

    private static JsonNode byId(JsonNode events, String id) {
        return StreamSupport.stream(events.spliterator(), false)
                .filter(event -> ("tennis-" + id).equals(event.path("id").asText()))
                .findFirst().orElseThrow();
    }

    private static JsonNode competitor(JsonNode event, String homeAway) {
        return StreamSupport.stream(event.path("competitions").get(0).path("competitors").spliterator(), false)
                .filter(node -> homeAway.equals(node.path("homeAway").asText()))
                .findFirst().orElseThrow();
    }

    @Test
    void supportsOnlyTheTournamentsOfTheCatalog() {
        assertTrue(provider.supports("tennis.atp.13"));
        assertTrue(provider.supports("tennis.wta.172"));
        assertFalse(provider.supports("tennis.wta.13"), "París no tiene cuadro femenino");
        assertFalse(provider.supports("tennis.atp.999"));
        assertFalse(provider.supports("esp.1"));
        assertFalse(provider.supports(null));
    }

    @Test
    void translatesOnlyTheMatchesFromTheRoundOf16On() throws Exception {
        JsonNode events = provider.fetchScoreboardEvents(PARIS, "2026");

        Map<String, Long> perRound = StreamSupport.stream(events.spliterator(), false)
                .collect(Collectors.groupingBy(event -> event.path("season").path("slug").asText(), Collectors.counting()));
        // En un cuadro de 56 los octavos son la tercera ronda; la previa y las dos primeras no se pronostican.
        assertEquals(Map.of("round-of-16", 8L, "quarterfinals", 4L, "semifinals", 2L, "final", 1L), perRound);
    }

    @Test
    void setsWonAreTheScoreAndPlayersComeWithTheirFlag() throws Exception {
        JsonNode match = byId(provider.fetchScoreboardEvents(PARIS, "2026"), "186503");

        JsonNode fritz = competitor(match, "away");
        assertEquals("Taylor Fritz", fritz.path("team").path("displayName").asText());
        assertTrue(fritz.path("team").path("id").asText().startsWith("tennis-"));
        assertTrue(fritz.path("team").path("logo").asText().startsWith("https://"));
        assertEquals("2", fritz.path("score").asText());
        assertTrue(fritz.path("winner").asBoolean());
        assertEquals("0", competitor(match, "home").path("score").asText());
        assertTrue(match.path("competitions").get(0).path("status").path("type").path("completed").asBoolean());
    }

    @Test
    void aWalkoverHasAWinnerButNoScore() throws Exception {
        JsonNode match = byId(provider.fetchScoreboardEvents(PARIS, "2026"), "186502");

        JsonNode status = match.path("competitions").get(0).path("status").path("type");
        assertEquals("STATUS_FINAL", status.path("name").asText());
        assertTrue(competitor(match, "away").path("winner").asBoolean(), "Alcaraz pasa por W.O.");
        assertTrue(competitor(match, "away").path("score").isMissingNode());
        assertTrue(competitor(match, "home").path("score").isMissingNode());
    }

    @Test
    void aScheduledFinalIsOpenAndHasNoScore() throws Exception {
        JsonNode match = byId(provider.fetchScoreboardEvents(PARIS, "2026"), "186507");

        assertEquals("pre", match.path("competitions").get(0).path("status").path("type").path("state").asText());
        assertEquals("Ben Shelton", competitor(match, "home").path("team").path("displayName").asText());
        assertFalse(competitor(match, "home").path("winner").asBoolean());
        assertTrue(competitor(match, "home").path("score").isMissingNode());
    }

    @Test
    void daysOutsideTheTournamentAskNothingToTheScoreboard() throws Exception {
        assertEquals(0, provider.fetchScoreboardEvents(PARIS, "20261120").size());
        assertTrue(requested.stream().noneMatch(url -> url.contains("scoreboard")));

        assertEquals(15, provider.fetchScoreboardEvents(PARIS, "20261107").size());
        assertEquals(15, provider.fetchScoreboardEvents(PARIS, "20261106").size());
        assertEquals(1, requested.stream().filter(url -> url.contains("scoreboard")).count(),
                "el marcador del torneo se reutiliza entre días");
    }

    @Test
    void teamsAreTheMainDrawPlayersWithoutQualifyingLosers() throws Exception {
        JsonNode teams = provider.fetchTeams(PARIS);

        List<String> names = StreamSupport.stream(teams.spliterator(), false)
                .map(team -> team.path("displayName").asText()).toList();
        assertTrue(names.contains("Carlos Alcaraz"));
        assertTrue(names.contains("Mattia Bellucci"), "llegó al cuadro final desde la previa");
        assertFalse(names.contains("Pablo Carreno Busta"), "perdió en la previa");
        assertFalse(names.contains("TBD"));
        assertEquals(names.size(), names.stream().distinct().count());
    }

    @Test
    void theSeasonWindowIsTheCurrentEditionWithAMargin() throws Exception {
        SportsDataProvider.SeasonWindow window = provider.fetchSeasonWindow(PARIS);

        assertEquals("2026-10-30T04:00:00Z", window.start());
        assertEquals("2026-11-10T04:59:00Z", window.end());
    }

    @Test
    void afterTheTournamentTheNextPublishedEditionIsTheCurrentOne() throws Exception {
        TennisDataProvider later = new TennisDataProvider(httpClient, JSON, CircuitBreakerRegistry.ofDefaults(),
                Clock.fixed(Instant.parse("2026-12-20T12:00:00Z"), ZoneOffset.UTC));

        // 13-2027 aún no está publicado: sigue valiendo la última edición, ya terminada.
        TennisDataProvider.Edition edition = later.currentEdition(PARIS);
        assertEquals("13-2026", edition.eventId());
        assertTrue(requested.stream().anyMatch(url -> url.endsWith("/events/13-2027")));
    }

    @Test
    void theRoundOf16IsTheLastNumberedRoundWithEightMatches() {
        List<String> rounds = new ArrayList<>();
        for (int i = 0; i < 16; i++) rounds.add("Round 3");
        for (int i = 0; i < 8; i++) rounds.add("Round 4");
        rounds.add("Quarterfinal");
        rounds.add("Qualifying Final");
        rounds.add("Group Stage");
        var matches = JSON.createArrayNode();
        for (int i = 0; i < rounds.size(); i++) {
            matches.addObject().put("id", String.valueOf(i)).putObject("round").put("displayName", rounds.get(i));
        }

        Map<String, String> slugs = TennisDataProvider.roundSlugs(matches);

        assertNull(slugs.get("0"), "la tercera ronda de un Grand Slam no se pronostica");
        assertEquals("round-of-16", slugs.get("16"));
        assertEquals("quarterfinals", slugs.get("24"));
        assertNull(slugs.get("25"), "la final de la previa no es la final");
        assertEquals("round-robin", slugs.get("26"));
    }
}
