package com.porra.mundial.sports;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Calendario y cartelera de la UFC a partir de respuestas reales de ESPN (recortadas). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UfcDataProviderTest {

    @Mock
    private HttpClient httpClient;

    private UfcDataProvider provider;
    private final List<String> requested = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        provider = new UfcDataProvider(httpClient, new ObjectMapper(), CircuitBreakerRegistry.ofDefaults());
        byte[] scoreboard = fixture("/ufc/scoreboard-2026.json");
        byte[] fightcenter = fixture("/ufc/fightcenter-600061420.json");
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenAnswer(invocation -> {
            HttpRequest request = invocation.getArgument(0);
            String url = request.uri().toString();
            requested.add(url);
            @SuppressWarnings("unchecked")
            HttpResponse<byte[]> response = org.mockito.Mockito.mock(HttpResponse.class);
            when(response.statusCode()).thenReturn(url.contains("fightcenter/600061420") || url.contains("scoreboard") ? 200 : 404);
            when(response.body()).thenReturn(url.contains("scoreboard") ? scoreboard : fightcenter);
            return response;
        });
    }

    private byte[] fixture(String path) throws Exception {
        try (var input = getClass().getResourceAsStream(path)) {
            return Objects.requireNonNull(input).readAllBytes();
        }
    }

    @Test
    void supportsOnlyTheUfc() {
        assertTrue(provider.supports("mma.ufc"));
        assertFalse(provider.supports("esp.1"));
        assertFalse(provider.supports("lol.worlds"));
        assertTrue(UfcDataProvider.isFighterId("ufc-a123"));
        assertFalse(UfcDataProvider.isFighterId("86"));
    }

    @Test
    void calendarKeepsUfcEventsAndSkipsTheContenderSeries() throws Exception {
        var calendar = UfcDataProvider.parseCalendar(new ObjectMapper()
                .readTree(fixture("/ufc/scoreboard-2026.json")).path("leagues").path(0).path("calendar"));

        assertEquals(List.of("UFC Fight Night: Moicano vs. Nolan", "UFC 334: Gane vs. Hokit"),
                calendar.stream().map(UfcDataProvider.CalendarEvent::name).toList());
        assertEquals("600061420", calendar.get(0).id());
    }

    @Test
    void everyFightBecomesAnEspnEventWithItsFightData() throws Exception {
        JsonNode fights = provider.fetchScoreboardEvents("mma.ufc", "20261031");

        // Solo la velada de ese día: la UFC 334 (14 de noviembre) no se descarga.
        assertEquals(4, fights.size());
        assertTrue(requested.stream().noneMatch(url -> url.contains("600061400")));

        JsonNode main = fights.get(0);
        assertEquals("ufc-401921310", main.path("id").asText());
        assertEquals("2026-11-01T00:00:00.000+00:00", main.path("date").asText());
        JsonNode competitors = main.path("competitions").get(0).path("competitors");
        // Esquina roja (order 1) como local.
        assertEquals("home", competitors.get(0).path("homeAway").asText());
        assertEquals("Renato Moicano", competitors.get(0).path("team").path("displayName").asText());
        assertEquals("ufc-a3028863", competitors.get(0).path("team").path("id").asText());
        assertEquals("0", competitors.get(0).path("score").asText());
        assertEquals("Tom Nolan", competitors.get(1).path("team").path("displayName").asText());
        assertEquals("1", competitors.get(1).path("score").asText());
        assertTrue(competitors.get(1).path("winner").asBoolean());
        assertTrue(main.path("competitions").get(0).path("status").path("type").path("completed").asBoolean());

        JsonNode ufc = main.path("ufc");
        assertEquals("600061420", ufc.path("eventId").asText());
        assertEquals("UFC Fight Night: Moicano vs. Nolan", ufc.path("eventName").asText());
        assertEquals("MAIN", ufc.path("segment").asText());
        assertEquals(1, ufc.path("order").asInt());
        assertEquals(5, ufc.path("rounds").asInt());
        assertEquals("kotko", ufc.path("method").asText());
        assertEquals("KO/TKO - Elbows", ufc.path("methodDetail").asText());
        assertEquals(3, ufc.path("round").asInt());
        assertEquals("1:28", ufc.path("clock").asText());
        assertEquals(4, ufc.path("card").size(), "cada pelea lleva la cartelera entera");

        JsonNode prelim = fights.get(2);
        assertEquals("PRELIMS", prelim.path("ufc").path("segment").asText());
        assertEquals(3, prelim.path("ufc").path("rounds").asInt());
    }

    @Test
    void aDayWithoutUfcEventsGivesNoFights() throws Exception {
        assertEquals(0, provider.fetchScoreboardEvents("mma.ufc", "20261104").size());
        assertTrue(requested.stream().noneMatch(url -> url.contains("fightcenter")));
    }

    @Test
    void anEventTouchesTheDaysOfItsBlocksInSpanishTime() {
        var event = new UfcDataProvider.CalendarEvent("1", "UFC 1",
                Instant.parse("2026-11-01T00:00:00Z"), Instant.parse("2026-11-01T07:59:00Z"));
        // Los preliminares empiezan el sábado por la tarde (hora peninsular) y la estelar ya es domingo.
        assertTrue(UfcDataProvider.touches(event, LocalDate.of(2026, 10, 31)));
        assertTrue(UfcDataProvider.touches(event, LocalDate.of(2026, 11, 1)));
        assertFalse(UfcDataProvider.touches(event, LocalDate.of(2026, 11, 2)));
    }

    @Test
    void mainEventsAndTitleFightsAreFiveRounds() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        assertEquals(5, UfcDataProvider.defaultRounds(mapper.readTree("{\"matchNumber\":1}")));
        assertEquals(5, UfcDataProvider.defaultRounds(mapper.readTree("{\"matchNumber\":2,\"note\":\"Flyweight - Title Fight\"}")));
        assertEquals(3, UfcDataProvider.defaultRounds(mapper.readTree("{\"matchNumber\":4}")));
        assertEquals("EARLY_PRELIMS", UfcDataProvider.segment("prelims2"));
        assertEquals("MAIN", UfcDataProvider.segment("main"));
    }
}
