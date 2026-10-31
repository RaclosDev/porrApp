package com.porra.mundial.sports;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EspnSportsDataProviderTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<byte[]> httpResponse;

    private ObjectMapper objectMapper;
    private EspnSportsDataProvider provider;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        provider = new EspnSportsDataProvider(httpClient, objectMapper, CircuitBreakerRegistry.ofDefaults());
    }

    @Test
    void fetchesAHistoricalEventByIdAndAdaptsItsVerifiedHeader() throws Exception {
        byte[] fixture;
        try (var input = getClass().getResourceAsStream("/espn/summary-401882926.json")) {
            fixture = java.util.Objects.requireNonNull(input).readAllBytes();
        }
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(fixture);
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of(), (key, value) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode event = provider.fetchEvent("esp.1", "401882926");

        assertEquals("401882926", event.path("id").asText());
        assertEquals("2026-08-15T17:30Z", event.path("date").asText());
        assertEquals("96", event.path("competitions").get(0).path("competitors").get(0).path("team").path("id").asText());
        var request = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(request.capture(), any());
        assertEquals("https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/summary?event=401882926",
                request.getValue().uri().toString());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"esp.1,other,401882926", "eng.1,401882926,401882926", "esp.1,401882926,other"})
    void rejectsSummaryFromAnotherEventOrCompetition(String slug, String headerId, String competitionId) throws Exception {
        String body = "{\"header\":{\"id\":\"%s\",\"league\":{\"slug\":\"%s\"},\"competitions\":[{\"id\":\"%s\"}]}}"
                .formatted(headerId, slug, competitionId);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(body.getBytes(StandardCharsets.UTF_8));
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of(), (key, value) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(java.io.IOException.class, () -> provider.fetchEvent("esp.1", "401882926"));
    }

    @Test
    void providerFailurePropagatesBeforeTheBreakerOpens() throws Exception {
        when(httpResponse.statusCode()).thenReturn(503);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(java.io.IOException.class, () -> provider.fetchScoreboardEvents("esp.1", "20261025"));
        assertTrue(provider.isAvailable());
    }

    @Test
    @DisplayName("Debe reportar ESPN como nombre del proveedor")
    void getProviderName_returnsEspn() {
        assertEquals("ESPN", provider.getProviderName());
    }

    @Test
    @DisplayName("Debe soportar múltiples competiciones (LaLiga, Champions, Premier, Mundial)")
    void supports_returnsTrueForSupportedCompetitions() {
        assertTrue(provider.supports("esp.1"));
        assertTrue(provider.supports("uefa.champions"));
        assertTrue(provider.supports("eng.1"));
        assertTrue(provider.supports("fifa.world"));
        assertTrue(provider.supports("LaLiga EA Sports"));
        assertTrue(provider.supports("UEFA Champions League"));
        assertTrue(provider.supports("Premier League"));
        assertTrue(provider.supports("FIFA World Cup 2026"));
    }

    @Test
    @DisplayName("Debe parsear correctamente el arreglo de eventos de ESPN en texto plano")
    void fetchScoreboardEvents_parsesJsonSuccessfully() throws Exception {
        String json = "{\"events\": [{\"id\": \"1\", \"name\": \"TeamA vs TeamB\"}]}";
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(json.getBytes(StandardCharsets.UTF_8));
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of(), (k, v) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode events = provider.fetchScoreboardEvents("esp.1", "20261024");

        assertNotNull(events);
        assertTrue(events.isArray());
        assertEquals(1, events.size());
        assertEquals("1", events.get(0).get("id").asText());
    }

    @Test
    @DisplayName("Debe descomprimir y parsear respuesta GZIP de ESPN")
    void fetchScoreboardEvents_decompressesGzip() throws Exception {
        String json = "{\"events\": [{\"id\": \"99\", \"name\": \"Final Match\"}]}";
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (GZIPOutputStream gzos = new GZIPOutputStream(baos)) {
            gzos.write(json.getBytes(StandardCharsets.UTF_8));
        }
        byte[] gzippedBytes = baos.toByteArray();

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(gzippedBytes);
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of("Content-Encoding", List.of("gzip")), (k, v) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode events = provider.fetchScoreboardEvents("uefa.champions", "20261025");

        assertNotNull(events);
        assertTrue(events.isArray());
        assertEquals(1, events.size());
        assertEquals("99", events.get(0).get("id").asText());
    }

    @Test
    @DisplayName("Una respuesta no JSON se comunica como fallo")
    void fetchScoreboardEvents_handlesNonJsonResponseGracefully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("<html><body>Error</body></html>".getBytes(StandardCharsets.UTF_8));
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of(), (k, v) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(java.io.IOException.class, () -> provider.fetchScoreboardEvents("esp.1", "20261024"));
    }

    @Test
    @DisplayName("Debe descargar y parsear el catálogo de equipos de una liga")
    void fetchTeams_parsesTeamsCorrectly() throws Exception {
        String json = "{\"sports\": [{\"leagues\": [{\"teams\": [{\"team\": {\"id\": \"96\", \"displayName\": \"Alavés\"}}]}]}]}";
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(json.getBytes(StandardCharsets.UTF_8));
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of(), (k, v) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode teams = provider.fetchTeams("esp.1");

        assertNotNull(teams);
        assertTrue(teams.isArray());
        assertEquals(1, teams.size());
        assertEquals("Alavés", teams.get(0).path("team").path("displayName").asText());
    }

    @Test
    @DisplayName("Un timeout se propaga al sincronizador")
    void fetchScoreboardEvents_handlesTimeoutGracefully() throws Exception {
        when(httpClient.<byte[]>send(any(HttpRequest.class), any()))
                .thenThrow(new java.net.http.HttpConnectTimeoutException("ESPN connection timed out"));

        assertThrows(java.io.IOException.class, () -> provider.fetchScoreboardEvents("esp.1", "20261025"));
    }

    @Test
    @DisplayName("Un error HTTP 500 o 503 se comunica al sincronizador")
    void fetchScoreboardEvents_handlesHttp500() throws Exception {
        when(httpResponse.statusCode()).thenReturn(503);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(java.io.IOException.class, () -> provider.fetchScoreboardEvents("esp.1", "20261025"));
    }

    /** Breaker que se abre con dos fallos de dos llamadas. */
    private EspnSportsDataProvider providerWithSensitiveBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .slidingWindowSize(2)
                .minimumNumberOfCalls(2)
                .failureRateThreshold(50)
                .build();
        return new EspnSportsDataProvider(httpClient, objectMapper, CircuitBreakerRegistry.of(config));
    }

    @Test
    @DisplayName("Tras fallos repetidos de ESPN el circuit breaker se abre y deja de llamarle")
    void opensTheCircuitBreakerAfterRepeatedFailures() throws Exception {
        EspnSportsDataProvider sensitive = providerWithSensitiveBreaker();
        when(httpResponse.statusCode()).thenReturn(503);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(java.io.IOException.class, () -> sensitive.fetchScoreboardEvents("esp.1", "20261025"));
        assertThrows(java.io.IOException.class, () -> sensitive.fetchScoreboardEvents("esp.1", "20261026"));
        assertThrows(io.github.resilience4j.circuitbreaker.CallNotPermittedException.class,
                () -> sensitive.fetchScoreboardEvents("esp.1", "20261027"));

        assertFalse(sensitive.isAvailable());
        verify(httpClient, times(2)).send(any(HttpRequest.class), any());
    }

    @Test
    @DisplayName("Un 404 de ESPN no cuenta como caída del proveedor")
    void clientErrorsDoNotOpenTheCircuitBreaker() throws Exception {
        EspnSportsDataProvider sensitive = providerWithSensitiveBreaker();
        when(httpResponse.statusCode()).thenReturn(404);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(java.io.IOException.class, () -> sensitive.fetchScoreboardEvents("esp.1", "20261025"));
        assertThrows(java.io.IOException.class, () -> sensitive.fetchScoreboardEvents("esp.1", "20261026"));
        assertThrows(java.io.IOException.class, () -> sensitive.fetchScoreboardEvents("esp.1", "20261027"));

        assertTrue(sensitive.isAvailable());
        verify(httpClient, times(3)).send(any(HttpRequest.class), any());
    }
}
