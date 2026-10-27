package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdaySubmissionDTO;
import com.porra.mundial.service.MatchPredictionService;
import com.porra.mundial.service.WebSocketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatchPredictionController.class)
@AutoConfigureMockMvc(addFilters = false)
class MatchPredictionValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MatchPredictionService matchPredictionService;

    @MockBean
    private WebSocketService webSocketService;

    @MockBean
    private JwtUtil jwtUtil;

    private final Principal mockPrincipal = () -> "player@test.com";

    @Test
    @DisplayName("submitMatchdayPredictions acepta pronósticos válidos con marcadores >= 0")
    void submitMatchdayPredictions_SuccessWithValidScores() throws Exception {
        MatchPredictionItemDTO item = MatchPredictionItemDTO.builder()
                .matchId(101L)
                .homeScore(2)
                .awayScore(1)
                .sign("1")
                .build();

        MatchdaySubmissionDTO submission = MatchdaySubmissionDTO.builder()
                .groupId(10L)
                .predictions(List.of(item))
                .build();

        when(matchPredictionService.saveMatchdayPredictions(eq("player@test.com"), eq(10L), anyList()))
                .thenReturn(1);

        mockMvc.perform(post("/api/predictions/matchday")
                        .principal(mockPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.saved").value(1));
    }

    @Test
    @DisplayName("submitMatchdayPredictions rechaza con 400 Bad Request si homeScore es negativo")
    void submitMatchdayPredictions_RejectsNegativeHomeScore() throws Exception {
        MatchPredictionItemDTO invalidItem = MatchPredictionItemDTO.builder()
                .matchId(101L)
                .homeScore(-1)
                .awayScore(2)
                .sign("2")
                .build();

        MatchdaySubmissionDTO submission = MatchdaySubmissionDTO.builder()
                .groupId(10L)
                .predictions(List.of(invalidItem))
                .build();

        mockMvc.perform(post("/api/predictions/matchday")
                        .principal(mockPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @DisplayName("submitMatchdayPredictions rechaza con 400 Bad Request si awayScore es negativo")
    void submitMatchdayPredictions_RejectsNegativeAwayScore() throws Exception {
        MatchPredictionItemDTO invalidItem = MatchPredictionItemDTO.builder()
                .matchId(101L)
                .homeScore(1)
                .awayScore(-3)
                .sign("1")
                .build();

        MatchdaySubmissionDTO submission = MatchdaySubmissionDTO.builder()
                .groupId(10L)
                .predictions(List.of(invalidItem))
                .build();

        mockMvc.perform(post("/api/predictions/matchday")
                        .principal(mockPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    @DisplayName("submitMatchdayPredictions rechaza con 400 Bad Request si la lista de predicciones está vacía")
    void submitMatchdayPredictions_RejectsEmptyPredictionsList() throws Exception {
        MatchdaySubmissionDTO submission = MatchdaySubmissionDTO.builder()
                .groupId(10L)
                .predictions(Collections.emptyList())
                .build();

        mockMvc.perform(post("/api/predictions/matchday")
                        .principal(mockPrincipal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Debes proporcionar al menos un pronóstico"));
    }
}
