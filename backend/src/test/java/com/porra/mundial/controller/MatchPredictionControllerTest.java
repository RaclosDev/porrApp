package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayFriendPredictionDTO;
import com.porra.mundial.dto.MatchdaySubmissionDTO;
import com.porra.mundial.service.MatchPredictionService;
import com.porra.mundial.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatchPredictionController.class)
@AutoConfigureMockMvc(addFilters = false)
class MatchPredictionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MatchPredictionService matchPredictionService;

    @MockBean
    private WebSocketService webSocketService;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    private static final Principal USER = () -> "user@test.com";

    @Test
    @DisplayName("GET /api/predictions/matchday devuelve la cartelera de partidos")
    void getMatchdayFixtures_ReturnsFixtures() throws Exception {
        MatchdayFixturePredictionDTO fixture = MatchdayFixturePredictionDTO.builder()
                .matchId(101L)
                .homeTeam("España")
                .awayTeam("Alemania")
                .locked(false)
                .build();

        Mockito.when(matchPredictionService.getMatchdayFixtures(any(), eq(10L), any()))
                .thenReturn(List.of(fixture));

        mockMvc.perform(get("/api/predictions/matchday?groupId=10").principal(USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].matchId").value(101))
                .andExpect(jsonPath("$[0].homeTeam").value("España"))
                .andExpect(jsonPath("$[0].awayTeam").value("Alemania"))
                .andExpect(jsonPath("$[0].locked").value(false));
    }

    @Test
    @DisplayName("POST /api/predictions/matchday guarda pronósticos correctamente")
    void submitMatchdayPredictions_Success() throws Exception {
        MatchdaySubmissionDTO dto = MatchdaySubmissionDTO.builder()
                .groupId(10L)
                .predictions(List.of(
                        MatchPredictionItemDTO.builder().matchId(101L).homeScore(2).awayScore(1).build()
                ))
                .build();

        Mockito.when(matchPredictionService.saveMatchdayPredictions(eq("user@test.com"), eq(10L), any()))
                .thenReturn(1);

        mockMvc.perform(post("/api/predictions/matchday").principal(USER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.saved").value(1));

        Mockito.verify(webSocketService).invalidateAndNotify();
    }

    @Test
    @DisplayName("POST /api/predictions/matchday devuelve 400 si el partido está bloqueado por plazo")
    void submitMatchdayPredictions_ReturnsBadRequestIfLocked() throws Exception {
        MatchdaySubmissionDTO dto = MatchdaySubmissionDTO.builder()
                .groupId(10L)
                .predictions(List.of(
                        MatchPredictionItemDTO.builder().matchId(102L).homeScore(1).awayScore(1).build()
                ))
                .build();

        Mockito.when(matchPredictionService.saveMatchdayPredictions(eq("user@test.com"), eq(10L), any()))
                .thenThrow(new IllegalStateException("El partido ya ha comenzado y está bloqueado."));

        mockMvc.perform(post("/api/predictions/matchday").principal(USER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("El partido ya ha comenzado y está bloqueado."));
    }

    @Test
    @DisplayName("GET /api/predictions/matchday/matches/{matchId}/predictions devuelve los pronósticos de los miembros")
    void getMatchdayFriendPredictions_ReturnsList() throws Exception {
        MatchdayFriendPredictionDTO friendPrediction = MatchdayFriendPredictionDTO.builder()
                .userId(1L)
                .participantName("Carlos")
                .homeScore(2)
                .awayScore(1)
                .sign("1")
                .pointsAwarded(5)
                .isExactScore(true)
                .hasPredicted(true)
                .build();

        Mockito.when(matchPredictionService.getFriendPredictionsForMatch(eq("user@test.com"), eq(10L), eq(101L)))
                .thenReturn(List.of(friendPrediction));

        mockMvc.perform(get("/api/predictions/matchday/matches/101/predictions").principal(USER)
                        .param("groupId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].participantName").value("Carlos"))
                .andExpect(jsonPath("$[0].pointsAwarded").value(5))
                .andExpect(jsonPath("$[0].sign").value("1"));
    }
}
