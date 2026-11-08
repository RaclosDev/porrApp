package com.porra.mundial.sports;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Temporada regular de la NBA desde ESPN: partido a partido y por semanas oficiales. */
class EspnNbaRegularSeasonTest {
    private static final Instant OPENING_DAY = Instant.parse("2026-10-20T07:00:00Z");

    private final ObjectMapper mapper = new ObjectMapper();
    private final EspnSportsDataProvider espn = mock(EspnSportsDataProvider.class);
    private EspnNbaDataProvider provider;

    @BeforeEach
    void setup() {
        provider = new EspnNbaDataProvider(espn, mapper);
    }

    private static String game(String id, String date, int seasonType, String headline,
                               String homeId, String home, String awayId, String away) {
        return """
                {"id":"%s","date":"%s","name":"%s at %s","season":{"year":2027,"type":%d,"slug":"regular-season"},
                 "competitions":[{"id":"%s","date":"%s","type":{"abbreviation":"STD"},
                   "notes":[%s],
                   "status":{"type":{"name":"STATUS_FINAL","state":"post","completed":true}},
                   "competitors":[
                     {"homeAway":"home","winner":false,"score":"102","team":{"id":"%s","displayName":"%s","logo":"https://a/%s.png"}},
                     {"homeAway":"away","winner":true,"score":"114","team":{"id":"%s","displayName":"%s","logo":"https://a/%s.png"}}]}]}
                """.formatted(id, date, away, home, seasonType, id, date,
                headline == null ? "" : "{\"type\":\"event\",\"headline\":\"" + headline + "\"}",
                homeId, home, homeId, awayId, away, awayId);
    }

    @Test
    @DisplayName("Las semanas van de lunes a domingo en la hora del Este y la 1 es la del partido inaugural")
    void weeksRunMondayToSundayEasternTime() {
        // Martes 20 de octubre por la noche en Nueva York (ya miércoles en UTC): semana 1.
        assertEquals(1, EspnNbaDataProvider.week(Instant.parse("2026-10-21T02:00:00Z"), OPENING_DAY));
        // Domingo 25 a las 22:00 en Nueva York (lunes 26 en UTC): aún semana 1.
        assertEquals(1, EspnNbaDataProvider.week(Instant.parse("2026-10-26T02:00:00Z"), OPENING_DAY));
        // Lunes 26 en Nueva York: semana 2.
        assertEquals(2, EspnNbaDataProvider.week(Instant.parse("2026-10-26T23:30:00Z"), OPENING_DAY));
        // Sábado 7 de noviembre: semana 3.
        assertEquals(3, EspnNbaDataProvider.week(Instant.parse("2026-11-08T01:00:00Z"), OPENING_DAY));
        // Pretemporada: antes del inicio no hay semana.
        assertEquals(0, EspnNbaDataProvider.week(Instant.parse("2026-10-10T23:00:00Z"), OPENING_DAY));
    }

    @Test
    @DisplayName("La temporada regular trae sus partidos con la semana, sin pretemporada ni cruces de la Copa sin equipos")
    void regularSeasonGamesComeWithTheirWeek() throws Exception {
        String scoreboard = """
                {"events":[%s,%s,%s]}
                """.formatted(
                game("401909938", "2026-11-07T22:00Z", 2, "NBA Cup - Group Play", "11", "Indiana Pacers", "7", "Denver Nuggets"),
                game("401800001", "2026-11-07T23:00Z", 1, null, "2", "Boston Celtics", "20", "Philadelphia 76ers"),
                game("401909999", "2026-11-07T23:30Z", 2, "NBA Cup - Quarterfinals", "-1", "TBD", "-2", "TBD"));
        when(espn.fetchEspnJson(contains("scoreboard?dates=20261107"))).thenReturn(mapper.readTree(scoreboard));
        when(espn.fetchEspnJson(contains("seasons/2027/types/2"))).thenReturn(mapper.readTree(
                "{\"startDate\":\"2026-10-20T07:00Z\",\"endDate\":\"2027-04-12T06:59Z\"}"));

        JsonNode events = provider.fetchScoreboardEvents("nba.regular", "20261107");

        assertEquals(1, events.size());
        JsonNode event = events.get(0);
        assertEquals("Semana 3", event.path("roundLabel").asText());
        assertEquals("401909938", event.path("id").asText());
        JsonNode home = event.path("competitions").path(0).path("competitors").path(0);
        assertEquals("nba-11", home.path("team").path("id").asText());
        assertEquals("102", home.path("score").asText());
        assertEquals("NBA Cup - Group Play",
                event.path("competitions").path(0).path("notes").path(0).path("headline").asText());

        // El inicio de la temporada se pide una vez y se guarda.
        provider.fetchScoreboardEvents("nba.regular", "20261107");
        verify(espn, times(1)).fetchEspnJson(contains("seasons/2027/types/2"));
    }

    @Test
    @DisplayName("Un año de temporada regular pide sus meses: de enero a abril y de octubre a diciembre")
    void aYearAsksForTheRegularSeasonMonths() throws Exception {
        when(espn.fetchEspnJson(contains("scoreboard?dates="))).thenReturn(mapper.readTree("{\"events\":[]}"));

        provider.fetchScoreboardEvents("nba.regular", "2026");

        for (String month : new String[]{"202601", "202602", "202603", "202604", "202610", "202611", "202612"}) {
            verify(espn).fetchEspnJson(contains("dates=" + month + "&"));
        }
    }

    @Test
    @DisplayName("La ventana de la temporada regular va de su primer a su último día")
    void theRegularSeasonWindowIsItsOwn() throws Exception {
        when(espn.fetchEspnJson(EspnNbaDataProvider.SCOREBOARD)).thenReturn(mapper.readTree(
                "{\"leagues\":[{\"season\":{\"year\":2027}}]}"));
        when(espn.fetchEspnJson(contains("seasons/2027/types/2"))).thenReturn(mapper.readTree(
                "{\"startDate\":\"2026-10-20T07:00Z\",\"endDate\":\"2027-04-12T06:59Z\"}"));

        SportsDataProvider.SeasonWindow window = provider.fetchSeasonWindow("nba.regular");

        assertEquals("2026-10-20T07:00Z", window.start());
        assertEquals("2027-04-12T06:59Z", window.end());
    }

    @Test
    @DisplayName("La misma API sigue la temporada regular y los playoffs, cada una en su competición")
    void supportsBothCompetitions() {
        assertTrue(provider.supports("nba"));
        assertTrue(provider.supports("nba.regular"));
        assertFalse(provider.supports("nfl"));
        assertTrue(EspnNbaDataProvider.isRegularSeason("nba.regular"));
        assertFalse(EspnNbaDataProvider.isRegularSeason("nba"));
    }
}
