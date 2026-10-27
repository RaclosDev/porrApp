package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
        provider = new EspnSportsDataProvider(httpClient, objectMapper);
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
    @DisplayName("Debe retornar array vacío de forma segura si la respuesta no es un JSON válido")
    void fetchScoreboardEvents_handlesNonJsonResponseGracefully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("<html><body>Error</body></html>".getBytes(StandardCharsets.UTF_8));
        when(httpResponse.headers()).thenReturn(HttpHeaders.of(Map.of(), (k, v) -> true));
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode events = provider.fetchScoreboardEvents("esp.1", "20261024");

        assertNotNull(events);
        assertTrue(events.isArray());
        assertEquals(0, events.size());
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
    @DisplayName("Debe manejar timeouts de conexión con ESPN retornando array vacío sin romper la app")
    void fetchScoreboardEvents_handlesTimeoutGracefully() throws Exception {
        when(httpClient.<byte[]>send(any(HttpRequest.class), any()))
                .thenThrow(new java.net.http.HttpConnectTimeoutException("ESPN connection timed out"));

        JsonNode events = provider.fetchScoreboardEvents("esp.1", "20261025");

        assertNotNull(events);
        assertTrue(events.isArray());
        assertEquals(0, events.size(), "Debe retornar un ArrayNode vacío ante timeout");
    }

    @Test
    @DisplayName("Debe manejar errores HTTP 500 y 503 retornando respuesta segura")
    void fetchScoreboardEvents_handlesHttp500() throws Exception {
        when(httpResponse.statusCode()).thenReturn(503);
        when(httpClient.<byte[]>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode events = provider.fetchScoreboardEvents("esp.1", "20261025");

        assertNotNull(events);
        assertTrue(events.isArray());
        assertEquals(0, events.size());
    }
}
