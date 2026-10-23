package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EspnSportsDataProviderTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    private ObjectMapper objectMapper;
    private EspnSportsDataProvider provider;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        provider = new EspnSportsDataProvider(httpClient, objectMapper);
        ReflectionTestUtils.setField(provider, "espnScoreboardUrl", "https://mock.espn.com/scoreboard");
    }

    @Test
    @DisplayName("Debe reportar ESPN como nombre del proveedor")
    void getProviderName_returnsEspn() {
        assertEquals("ESPN", provider.getProviderName());
    }

    @Test
    @DisplayName("Debe parsear correctamente el arreglo de eventos de ESPN")
    void fetchScoreboardEvents_parsesJsonSuccessfully() throws Exception {
        String json = "{\"events\": [{\"id\": \"1\", \"name\": \"TeamA vs TeamB\"}]}";
        when(httpResponse.body()).thenReturn(json);
        when(httpClient.<String>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        JsonNode events = provider.fetchScoreboardEvents("20260611-20260722");

        assertNotNull(events);
        assertTrue(events.isArray());
        assertEquals(1, events.size());
        assertEquals("1", events.get(0).get("id").asText());
    }

    @Test
    @DisplayName("Debe lanzar excepcion si la respuesta no es un JSON valido")
    void fetchScoreboardEvents_throwsOnNonJsonResponse() throws Exception {
        when(httpResponse.body()).thenReturn("<html><body>Error</body></html>");
        when(httpClient.<String>send(any(HttpRequest.class), any())).thenReturn(httpResponse);

        assertThrows(IllegalStateException.class, () ->
                provider.fetchScoreboardEvents("20260611-20260722")
        );
    }
}
