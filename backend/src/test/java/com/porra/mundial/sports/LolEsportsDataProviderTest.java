package com.porra.mundial.sports;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LolEsportsDataProviderTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<byte[]> httpResponse;

    private LolEsportsDataProvider provider;

    @BeforeEach
    void setUp() {
        provider = new LolEsportsDataProvider(httpClient, new ObjectMapper(), CircuitBreakerRegistry.ofDefaults(), "test-key");
    }

    private void respondWithFixture() throws Exception {
        byte[] fixture;
        try (var input = getClass().getResourceAsStream("/lolesports/schedule-worlds.json")) {
            fixture = Objects.requireNonNull(input).readAllBytes();
        }
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(fixture);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);
    }

    @ParameterizedTest
    @CsvSource({
            "win, loss, 3, 1, true",
            "null, null, 3, 1, true",
            "null, null, 2, 1, false",
            "null, null, 0, 0, false"
    })
    void inProgressSeriesAlreadyDecidedCountAsFinished(String homeOutcome, String awayOutcome,
                                                      int homeWins, int awayWins, boolean decided) {
        var match = new ObjectMapper().readTree("""
                {"strategy": {"type": "bestOf", "count": 5}, "teams": [
                  {"result": {"outcome": %s, "gameWins": %d}},
                  {"result": {"outcome": %s, "gameWins": %d}}]}
                """.formatted(json(homeOutcome), homeWins, json(awayOutcome), awayWins));

        assertEquals(decided, LolEsportsDataProvider.isDecided(match));
    }

    private static String json(String outcome) {
        return "null".equals(outcome) ? "null" : "\"" + outcome + "\"";
    }

    @Test
    void supportsOnlyKnownLolCompetitions() {
        assertTrue(provider.supports("lol.worlds"));
        assertFalse(provider.supports("fifa.world"));
        assertFalse(provider.supports("Mundial"));
        assertFalse(provider.supports(null));
    }

    @Test
    void adaptsCompletedSeriesToEspnEventsWithGameWinsAsScore() throws Exception {
        respondWithFixture();

        JsonNode events = provider.fetchScoreboardEvents("lol.worlds", "2026");

        assertEquals(4, events.size(), "las retransmisiones que no son partidos se descartan");
        JsonNode bo3 = events.get(1);
        assertEquals("115660540725900002", bo3.path("id").asText());
        assertEquals("2026-11-01T08:00:00Z", bo3.path("date").asText());
        assertEquals("group-stage", bo3.path("season").path("slug").asText());
        JsonNode competition = bo3.path("competitions").get(0);
        assertTrue(competition.path("status").path("type").path("completed").asBoolean());
        JsonNode home = competition.path("competitors").get(0);
        assertEquals("home", home.path("homeAway").asText());
        assertEquals("Bilibili Gaming", home.path("team").path("displayName").asText());
        assertEquals("lol-BLG", home.path("team").path("id").asText());
        assertEquals("2", home.path("score").asText());
        assertTrue(home.path("winner").asBoolean());
        JsonNode away = competition.path("competitors").get(1);
        assertEquals("1", away.path("score").asText());
        assertFalse(away.path("winner").asBoolean());

        var request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(request.capture(), any());
        assertEquals("https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US&leagueId=98767975604431411",
                request.getValue().uri().toString());
        assertEquals("test-key", request.getValue().headers().firstValue("x-api-key").orElseThrow());
    }

    @Test
    void unstartedSeriesHaveNoScoreAndUndecidedTeamsAreLeftEmpty() throws Exception {
        respondWithFixture();

        JsonNode events = provider.fetchScoreboardEvents("lol.worlds", null);

        JsonNode quarter = events.get(2).path("competitions").get(0);
        assertEquals("pre", quarter.path("status").path("type").path("state").asText());
        assertTrue(quarter.path("competitors").get(0).path("score").isMissingNode());
        JsonNode finalSeries = events.get(3);
        assertEquals("final", finalSeries.path("season").path("slug").asText());
        assertTrue(finalSeries.path("competitions").get(0).path("competitors").get(0).path("team").isMissingNode());
    }

    @Test
    void filtersByDayInSpanishTimeAndReusesTheDownloadedSchedule() throws Exception {
        respondWithFixture();

        // 22:00Z del 4 de noviembre son las 23:00 en Madrid: sigue siendo el día 4.
        JsonNode day = provider.fetchScoreboardEvents("lol.worlds", "20261104");
        JsonNode otherDay = provider.fetchScoreboardEvents("lol.worlds", "20261023");

        assertEquals(1, day.size());
        assertEquals("115660540726095115", day.get(0).path("id").asText());
        assertEquals(1, otherDay.size());
        verify(httpClient, times(1)).send(any(HttpRequest.class), any());
    }

    @Test
    void teamCatalogSkipsUndecidedSlotsAndDuplicates() throws Exception {
        respondWithFixture();

        JsonNode teams = provider.fetchTeams("lol.worlds");

        assertEquals(5, teams.size());
        assertEquals("GEN", teams.get(1).path("abbreviation").asText());
        assertEquals("http://static.lolesports.com/teams/gen.png", teams.get(1).path("logo").asText());
    }

    @Test
    void replacesWhiteLogosWithOwnLogos() throws Exception {
        String fixture;
        try (var input = getClass().getResourceAsStream("/lolesports/schedule-worlds.json")) {
            fixture = new String(Objects.requireNonNull(input).readAllBytes(), StandardCharsets.UTF_8);
        }
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(
                fixture.replace("\"code\": \"IG\"", "\"code\": \"DK\"").replace("\"code\": \"BLG\"", "\"code\": \"TSW\"").getBytes(StandardCharsets.UTF_8));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode teams = provider.fetchTeams("lol.worlds");

        var logos = new java.util.HashMap<String, String>();
        teams.forEach(team -> logos.put(team.path("abbreviation").asText(), team.path("logo").asText()));
        assertEquals("/logos/dplus-kia.svg", logos.get("DK"));
        assertEquals("/logos/team-secret.png", logos.get("TSW"));
        assertEquals("http://static.lolesports.com/teams/gen.png", teams.get(1).path("logo").asText());
    }

    @Test
    void findsASeriesById() throws Exception {
        respondWithFixture();

        assertEquals("115660540725900001", provider.fetchEvent("lol.worlds", "115660540725900001").path("id").asText());
        assertThrows(IOException.class, () -> provider.fetchEvent("lol.worlds", "999"));
    }

    @Test
    void httpErrorsAreFailuresNotEmptySchedules() throws Exception {
        when(httpResponse.statusCode()).thenReturn(403);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(IOException.class, () -> provider.fetchScoreboardEvents("lol.worlds", "2026"));
    }

    @ParameterizedTest
    @CsvSource({
            "Play-In, play-in",
            "Play-In Final, play-in",
            "Swiss Stage, group-stage",
            "Quarterfinals, quarterfinals",
            "Semifinals, semifinals",
            "Finals, final"
    })
    void mapsBlockNamesToRounds(String blockName, String slug) {
        assertEquals(slug, LolEsportsDataProvider.roundSlug(blockName));
    }
}
