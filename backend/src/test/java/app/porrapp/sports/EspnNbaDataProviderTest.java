package app.porrapp.sports;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Playoffs de la NBA desde ESPN, traducidos al formato de evento que procesa la sincronización. */
class EspnNbaDataProviderTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final EspnSportsDataProvider espn = mock(EspnSportsDataProvider.class);
    private EspnNbaDataProvider provider;

    @BeforeEach
    void setup() {
        provider = new EspnNbaDataProvider(espn, mapper);
    }

    /** Partido con la forma del marcador de ESPN (abreviado). */
    private static String game(String id, int seasonType, String typeAbbreviation, String headline, String status,
                               String homeId, String home, int homeScore, boolean homeWins,
                               String awayId, String away, int awayScore, String series) {
        boolean completed = "STATUS_FINAL".equals(status);
        return """
                {"id":"%s","date":"2025-06-23T00:00Z","name":"%s at %s",
                 "season":{"year":2025,"type":%d,"slug":"post-season"},
                 "competitions":[{"id":"%s","date":"2025-06-23T00:00Z","type":{"abbreviation":"%s"},
                   "notes":[{"type":"event","headline":"%s"}],
                   "status":{"type":{"name":"%s","state":"%s","completed":%s}},
                   %s
                   "competitors":[
                     {"homeAway":"home","winner":%s,"score":"%d","team":{"id":"%s","displayName":"%s","logo":"https://a/%s.png"}},
                     {"homeAway":"away","winner":%s,"score":"%d","team":{"id":"%s","displayName":"%s","logo":"https://a/%s.png"}}]}]}
                """.formatted(id, away, home, seasonType, id, typeAbbreviation, headline, status,
                completed ? "post" : "pre", completed, series == null ? "" : "\"series\":" + series + ",",
                completed && homeWins, homeScore, homeId, home, homeId,
                completed && !homeWins, awayScore, awayId, away, awayId);
    }

    private JsonNode adapt(String json) throws Exception {
        return provider.adapt(mapper.readTree(json));
    }

    @Test
    @DisplayName("Los playoffs importan desde los anteriores, pero su temporada empieza donde dice ESPN")
    void thePlayoffWindowKnowsWhereItsSeasonStarts() throws Exception {
        when(espn.fetchEspnJson(EspnNbaDataProvider.SCOREBOARD)).thenReturn(mapper.readTree(
                "{\"leagues\":[{\"season\":{\"year\":2027,\"startDate\":\"2026-10-01T07:00Z\","
                        + "\"endDate\":\"2027-06-27T06:59Z\"}}]}"));

        SportsDataProvider.SeasonWindow window = provider.fetchSeasonWindow("nba");

        assertEquals("2026-04-01T00:00Z", window.start());
        assertEquals("2027-06-27T06:59Z", window.end());
        assertEquals("2026-10-01T07:00Z", window.seasonStart());
    }

    @Test
    @DisplayName("El partido que da la cuarta victoria marca quién gana la serie, con la ronda de las Finales")
    void clinchingGameAdvancesTheSeriesWinner() throws Exception {
        JsonNode event = adapt(game("401766128", 3, "FINAL", "NBA Finals - Game 7", "STATUS_FINAL",
                "25", "Oklahoma City Thunder", 103, true, "11", "Indiana Pacers", 91,
                """
                {"type":"playoff","completed":true,"totalCompetitions":7,
                 "competitors":[{"id":"25","wins":4},{"id":"11","wins":3}]}"""));

        assertEquals("final", event.path("season").path("slug").asText());
        JsonNode competitors = event.path("competitions").path(0).path("competitors");
        assertEquals("nba-25", competitors.path(0).path("team").path("id").asText());
        assertEquals("Oklahoma City Thunder", competitors.path(0).path("team").path("displayName").asText());
        assertTrue(competitors.path(0).path("advance").asBoolean());
        assertFalse(competitors.path(1).path("advance").asBoolean());
        assertEquals("103", competitors.path(0).path("score").asText());
    }

    @Test
    @DisplayName("Un partido de mitad de serie no da ganador del cruce aunque tenga ganador del partido")
    void midSeriesGameHasNoQualifier() throws Exception {
        JsonNode event = adapt(game("401767818", 3, "RD16", "West 1st Round - Game 1", "STATUS_FINAL",
                "25", "Oklahoma City Thunder", 131, true, "29", "Memphis Grizzlies", 80,
                """
                {"type":"playoff","completed":false,"totalCompetitions":7,
                 "competitors":[{"id":"25","wins":1},{"id":"29","wins":0}]}"""));

        assertEquals("round-of-16", event.path("season").path("slug").asText());
        for (JsonNode competitor : event.path("competitions").path(0).path("competitors")) {
            assertFalse(competitor.path("advance").asBoolean());
        }
    }

    @Test
    @DisplayName("Rondas: primera ronda, semifinales y finales de conferencia, Finales y play-in")
    void roundsFromTypeOrHeadline() throws Exception {
        assertEquals("quarterfinals", adapt(game("1", 3, "QTR", "East Semifinals - Game 2", "STATUS_SCHEDULED",
                "2", "Boston Celtics", 0, false, "18", "New York Knicks", 0, null)).path("season").path("slug").asText());
        assertEquals("semifinals", adapt(game("2", 3, "SEMI", "West Finals - Game 1", "STATUS_SCHEDULED",
                "25", "Oklahoma City Thunder", 0, false, "13", "Minnesota Timberwolves", 0, null))
                .path("season").path("slug").asText());
        // Sin tipo, la ronda sale de la nota.
        assertEquals("semifinals", adapt(game("3", 3, "", "East Finals - Game 3", "STATUS_SCHEDULED",
                "11", "Indiana Pacers", 0, false, "18", "New York Knicks", 0, null)).path("season").path("slug").asText());
        assertEquals("final", adapt(game("4", 3, "", "NBA Finals - Game 1", "STATUS_SCHEDULED",
                "25", "Oklahoma City Thunder", 0, false, "11", "Indiana Pacers", 0, null)).path("season").path("slug").asText());

        JsonNode playIn = adapt(game("5", 5, "STD", "NBA Play-In - East - 7th Place vs 8th Place", "STATUS_FINAL",
                "19", "Orlando Magic", 120, true, "1", "Atlanta Hawks", 95, null));
        assertEquals("play-in", playIn.path("season").path("slug").asText());
        assertTrue(playIn.path("competitions").path(0).path("competitors").path(0).path("advance").asBoolean());
    }

    @Test
    @DisplayName("La temporada regular y los rivales por decidir no se guardan")
    void skipsRegularSeasonAndUnknownTeams() throws Exception {
        assertNull(adapt(game("6", 2, "STD", "", "STATUS_FINAL",
                "2", "Boston Celtics", 100, true, "18", "New York Knicks", 90, null)));
        assertNull(adapt(game("7", 3, "RD16", "East 1st Round - Game 1", "STATUS_SCHEDULED",
                "5", "Cleveland Cavaliers", 0, false, "-1", "TBD", 0, null)));
    }

    @Test
    @DisplayName("Un año pide abril, mayo y junio; un día fuera de los playoffs no hace petición")
    void queriesOnlyPlayoffMonths() throws Exception {
        List<String> urls = new ArrayList<>();
        when(espn.fetchEspnJson(anyString())).thenAnswer(call -> {
            urls.add(call.getArgument(0));
            return mapper.readTree("""
                    {"events":[%s]}""".formatted(game("401766128", 3, "FINAL", "NBA Finals - Game 7", "STATUS_FINAL",
                    "25", "Oklahoma City Thunder", 103, true, "11", "Indiana Pacers", 91, null)));
        });

        JsonNode events = provider.fetchScoreboardEvents("nba", "2025");

        assertEquals(List.of(EspnNbaDataProvider.SCOREBOARD + "?dates=202504&limit=1000",
                EspnNbaDataProvider.SCOREBOARD + "?dates=202505&limit=1000",
                EspnNbaDataProvider.SCOREBOARD + "?dates=202506&limit=1000"), urls);
        assertEquals(3, events.size());

        urls.clear();
        assertEquals(0, provider.fetchScoreboardEvents("nba", "20251107").size());
        assertTrue(urls.isEmpty());
    }

    @Test
    @DisplayName("Catálogo de equipos con id prefijado y sin abreviatura (la de la MLS coincidiría)")
    void teamsArePrefixed() throws Exception {
        when(espn.fetchEspnJson(anyString())).thenReturn(mapper.readTree("""
                {"sports":[{"leagues":[{"teams":[
                  {"team":{"id":"1","abbreviation":"ATL","displayName":"Atlanta Hawks","logos":[{"href":"https://a/atl.png"}]}},
                  {"team":{"id":"31","abbreviation":"EST","displayName":"Team Stephen"}}]}]}]}"""));

        JsonNode teams = provider.fetchTeams("nba");

        assertEquals(1, teams.size());
        assertEquals("nba-1", teams.path(0).path("id").asText());
        assertEquals("https://a/atl.png", teams.path(0).path("logo").asText());
        assertFalse(teams.path(0).has("abbreviation"));
    }

    @Test
    @DisplayName("Solo atiende a la NBA y sabe la conferencia de cada franquicia")
    void supportsAndConferences() throws Exception {
        assertTrue(provider.supports("nba"));
        assertFalse(provider.supports("esp.1"));
        assertEquals("W", EspnNbaDataProvider.conference("nba-25"));
        assertEquals("E", EspnNbaDataProvider.conference("2"));
        assertNull(EspnNbaDataProvider.conference("nba-99"));
        verify(espn, never()).fetchEspnJson(anyString());
    }
}
