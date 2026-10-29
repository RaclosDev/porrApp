package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.sports.EspnSportsDataProvider;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.dto.TopScorerDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TopScorerServiceTest {

    @Mock
    private WebSocketService webSocketService;

    @Mock
    private HttpClient httpClient;

    @Mock
    private SportsDataProvider sportsDataProvider;

    private ObjectMapper objectMapper;
    private TopScorerService topScorerService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        topScorerService = new TopScorerService(objectMapper, webSocketService, httpClient, sportsDataProvider);
    }

    @Test
    @DisplayName("Debe resolver la inyeccion de Spring con el proveedor ESPN registrado")
    void springContext_resolvesSportsDataProviderWithoutAmbiguity() {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.register(TestContextConfig.class);
        context.register(EspnSportsDataProvider.class);
        context.register(TopScorerService.class);
        context.refresh();

        TopScorerService resolvedService = context.getBean(TopScorerService.class);
        assertNotNull(resolvedService);

        SportsDataProvider resolvedDefaultProvider = context.getBean(SportsDataProvider.class);
        assertTrue(resolvedDefaultProvider instanceof EspnSportsDataProvider,
                "El proveedor primario por defecto debe ser EspnSportsDataProvider");

        context.close();
    }

    @Test
    @DisplayName("Debe procesar eventos y calcular la lista de goleadores ordenada por goles")
    void refresh_processesEventsAndOrdersScorers() throws Exception {
        String json = """
        [
          {
            "competitions": [
              {
                "competitors": [
                  { "id": "1", "team": { "displayName": "France" } },
                  { "id": "2", "team": { "displayName": "Argentina" } }
                ],
                "details": [
                  {
                    "scoringPlay": true,
                    "ownGoal": false,
                    "team": { "id": "1" },
                    "athletesInvolved": [
                      { "id": "10", "displayName": "Kylian Mbappé", "shortName": "K. Mbappé", "position": "FW" }
                    ]
                  },
                  {
                    "scoringPlay": true,
                    "ownGoal": false,
                    "team": { "id": "1" },
                    "athletesInvolved": [
                      { "id": "10", "displayName": "Kylian Mbappé", "shortName": "K. Mbappé", "position": "FW" }
                    ]
                  },
                  {
                    "scoringPlay": true,
                    "ownGoal": false,
                    "team": { "id": "2" },
                    "athletesInvolved": [
                      { "id": "11", "displayName": "Lionel Messi", "shortName": "L. Messi", "position": "FW" }
                    ]
                  },
                  {
                    "scoringPlay": true,
                    "ownGoal": true,
                    "team": { "id": "2" },
                    "athletesInvolved": [
                      { "id": "12", "displayName": "Defender", "shortName": "Defender", "position": "DF" }
                    ]
                  },
                  {
                    "scoringPlay": false,
                    "ownGoal": false,
                    "athletesInvolved": [
                      { "id": "13", "displayName": "Nobody", "shortName": "Nobody", "position": "MF" }
                    ]
                  }
                ]
              }
            ]
          }
        ]
        """;

        JsonNode events = objectMapper.readTree(json);
        when(sportsDataProvider.fetchScoreboardEvents(anyString())).thenReturn(events);

        topScorerService.refresh();

        List<TopScorerDTO> scorers = topScorerService.getTopScorers();
        assertNotNull(scorers);
        assertEquals(2, scorers.size());

        assertEquals("Kylian Mbappé", scorers.get(0).name());
        assertEquals(2, scorers.get(0).goals());
        assertEquals("France", scorers.get(0).team());

        assertEquals("Lionel Messi", scorers.get(1).name());
        assertEquals(1, scorers.get(1).goals());
        assertEquals("Argentina", scorers.get(1).team());

        verify(webSocketService, times(1)).invalidateAndNotify();
    }

    @Test
    @DisplayName("Debe manejar fallos del proveedor sin propagar excepcion")
    void refresh_handlesExceptionGracefully() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(anyString())).thenThrow(new RuntimeException("API error"));

        assertDoesNotThrow(() -> topScorerService.refresh());
        assertTrue(topScorerService.getTopScorers().isEmpty());
        verify(webSocketService, never()).invalidateAndNotify();
    }

    @Test
    @DisplayName("Debe ignorar cuando el proveedor devuelve null")
    void refresh_ignoresNullEvents() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(anyString())).thenReturn(null);

        assertDoesNotThrow(() -> topScorerService.refresh());
        assertTrue(topScorerService.getTopScorers().isEmpty());
        verify(webSocketService, never()).invalidateAndNotify();
    }

    @Test
    @DisplayName("scheduledRefresh debe invocar el refresco de goleadores")
    void scheduledRefresh_callsRefresh() throws Exception {
        when(sportsDataProvider.fetchScoreboardEvents(anyString())).thenReturn(objectMapper.createArrayNode());

        topScorerService.scheduledRefresh();

        verify(sportsDataProvider, times(1)).fetchScoreboardEvents(anyString());
        verify(webSocketService, times(1)).invalidateAndNotify();
    }

    @Configuration
    static class TestContextConfig {
        @Bean
        public ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        public WebSocketService webSocketService() {
            return mock(WebSocketService.class);
        }

        @Bean
        public HttpClient httpClient() {
            return mock(HttpClient.class);
        }
    }
}
