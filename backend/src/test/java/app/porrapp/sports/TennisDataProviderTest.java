package app.porrapp.sports;

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
    private static final String FINALS = "tennis.atp.339";
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
                "/atp/scoreboard?dates=20261031", paris,
                // ATP Finals 2026: publicadas en el calendario, pero aún sin cuadro.
                "/leagues/atp/events/339-2026", """
                        {"id": "339-2026", "date": "2026-11-14T05:00Z", "endDate": "2026-11-23T04:59Z"}
                        """.getBytes(StandardCharsets.UTF_8),
                "/atp/scoreboard?dates=20261114", """
                        {"events": [{"id": "148-2026", "groupings": []}, {"id": "339-2026", "groupings": []}]}
                        """.getBytes(StandardCharsets.UTF_8),
                "/leagues/atp/events/339-2025", """
                        {"id": "339-2025", "date": "2025-11-09T05:00Z", "endDate": "2025-11-17T04:59Z"}
                        """.getBytes(StandardCharsets.UTF_8),
                "/atp/scoreboard?dates=20251109", finals2025().getBytes(StandardCharsets.UTF_8));
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

    /** Las ATP Finals 2025 resumidas: un partido de grupos, una semifinal y la final, y uno de dobles. */
    private static String finals2025() {
        String singles = """
                {"grouping": {"slug": "mens-singles"}, "competitions": [
                  %s, %s, %s
                ]}""".formatted(
                finalsMatch("167265", "Group Stage", "3623", "Jannik Sinner", "2651", "Alex de Minaur"),
                finalsMatch("167714", "Semifinal", "3623", "Jannik Sinner", "3782", "Carlos Alcaraz"),
                finalsMatch("167710", "Final", "3623", "Jannik Sinner", "3782", "Carlos Alcaraz"));
        String doubles = """
                {"grouping": {"slug": "mens-doubles"}, "competitions": [%s]}""".formatted(
                finalsMatch("167278", "Group Stage", "1", "Granollers", "2", "Krawietz"));
        return "{\"events\": [{\"id\": \"339-2025\", \"groupings\": [" + singles + "," + doubles + "]}]}";
    }

    private static String finalsMatch(String id, String round, String homeId, String home, String awayId, String away) {
        return """
                {"id": "%s", "date": "2025-11-10T13:00Z", "round": {"displayName": "%s"},
                 "status": {"type": {"name": "STATUS_FINAL", "state": "post", "completed": true}},
                 "competitors": [
                   {"id": "%s", "type": "athlete", "order": 1, "winner": true, "athlete": {"displayName": "%s"},
                    "linescores": [{"winner": true}, {"winner": true}]},
                   {"id": "%s", "type": "athlete", "order": 2, "winner": false, "athlete": {"displayName": "%s"},
                    "linescores": [{"winner": false}, {"winner": false}]}
                 ]}""".formatted(id, round, homeId, home, awayId, away);
    }

    @Test
    void theAtpFinalsWithoutADrawHaveNoMatchesYetButKeepTheirDates() throws Exception {
        assertEquals(0, provider.fetchScoreboardEvents(FINALS, null).size());
        assertEquals(0, provider.fetchScoreboardEvents(FINALS, "20261115").size());
        assertEquals(0, provider.fetchTeams(FINALS).size());
        // Las fechas sí: la sincronización sigue consultando esos días y recoge el cuadro en cuanto sale.
        assertEquals("2026-11-13T05:00:00Z", provider.fetchSeasonWindow(FINALS).start());
    }

    @Test
    void theAtpFinalsTranslateTheGroupStageSemifinalsAndFinalOfTheSinglesDraw() throws Exception {
        JsonNode events = provider.fetchScoreboardEvents(FINALS, "2025");

        Map<String, String> rounds = StreamSupport.stream(events.spliterator(), false)
                .collect(Collectors.toMap(e -> e.path("id").asText(), e -> e.path("season").path("slug").asText()));
        assertEquals(Map.of("tennis-167265", "round-robin", "tennis-167714", "semifinals",
                "tennis-167710", "final"), rounds);
        JsonNode group = byId(events, "167265");
        assertEquals("2", competitor(group, "home").path("score").asText());
        assertEquals("tennis-3623", competitor(group, "home").path("team").path("id").asText());
    }

    private static JsonNode byId(JsonNode events, String id) {
        return StreamSupport.stream(events.spliterator(), false)
                .filter(event -> ("tennis-" + id).equals(event.path("id").asText()))
                .findFirst().orElseThrow();
    }

    private static String clock(JsonNode event) {
        return event.path("competitions").get(0).path("status").path("displayClock").asText(null);
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
    void theGamesOfEachSetGoInTheClockWithTheTiebreakOfItsLoser() throws Exception {
        JsonNode events = provider.fetchScoreboardEvents(PARIS, "2026");

        assertEquals("3-6 4-6", clock(byId(events, "186503")), "Fils, el primero, pierde");
        assertEquals("7-6(10) 5-7 3-6", clock(byId(events, "186492")));
        assertEquals("3-6 6-4 7-6(5)", clock(byId(events, "186497")));
        assertTrue(byId(events, "186507").path("competitions").get(0).path("status").path("displayClock")
                .isMissingNode(), "La final por jugar no tiene marcador");
    }

    @Test
    void aRetirementKeepsTheGamesPlayedAndSaysHowItEnded() throws Exception {
        JsonNode match = JSON.readTree("""
                {"competitors": [
                  {"homeAway": "home", "linescores": [{"value": 6}, {"value": 2}]},
                  {"homeAway": "away", "linescores": [{"value": 4}, {"value": 1}]}]}""");

        assertEquals("6-4 2-1 RET", TennisDataProvider.scoreLine(match, "STATUS_RETIRED"));
        assertEquals("6-4 2-1", TennisDataProvider.scoreLine(match, null), "En directo, solo los juegos");
        assertEquals("WO", TennisDataProvider.scoreLine(JSON.readTree("{\"competitors\": []}"),
                "STATUS_WALKOVER"));
        assertNull(TennisDataProvider.scoreLine(JSON.readTree("{\"competitors\": []}"), "STATUS_FINAL"));
    }

    @Test
    void aWalkoverHasAWinnerButNoScore() throws Exception {
        JsonNode match = byId(provider.fetchScoreboardEvents(PARIS, "2026"), "186502");

        JsonNode status = match.path("competitions").get(0).path("status").path("type");
        assertEquals("WO", clock(match));
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
