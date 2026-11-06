package com.porra.mundial.controller;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.LeagueService;
import com.porra.mundial.service.LeaderboardService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LeaderboardController.class)
@AutoConfigureMockMvc(addFilters = false)
class LeaderboardControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @MockitoBean
    private LeaderboardService leaderboardService;

    @MockitoBean
    private LeagueService leagueService;

    @MockitoBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @Autowired
    private MockMvc mockMvc;

    private static ParticipantScoreDTO score() {
        return ParticipantScoreDTO.builder()
                .id(7L).userId(3L).name("Ana").total(12)
                .log(List.of(ParticipantScoreDTO.LogEntry.builder().stage("r1").amount(2).msg("Grupo A").build()))
                .exactMatches(Map.of("A", Map.of("1", true)))
                .passedTeams(Map.of("España", true))
                .build();
    }

    @Test
    @DisplayName("La clasificación no incluye el desglose de cada pronóstico y se revalida siempre")
    void leaderboardIsLight() throws Exception {
        when(leaderboardService.getLeaderboard(1L)).thenReturn(List.of(score()));

        mockMvc.perform(get("/api/leaderboard").param("groupId", "1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache, private"))
                .andExpect(jsonPath("$[0].total").value(12))
                .andExpect(jsonPath("$[0].log").doesNotExist())
                .andExpect(jsonPath("$[0].exactMatches").doesNotExist())
                .andExpect(jsonPath("$[0].passedTeams").doesNotExist());
    }

    @Test
    @DisplayName("El registro de puntos de la liga se pide aparte, por id de pronóstico")
    void logsByPrediction() throws Exception {
        when(leaderboardService.getLeaderboard(1L)).thenReturn(List.of(score()));

        mockMvc.perform(get("/api/leaderboard/logs").param("groupId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['7'][0].msg").value("Grupo A"));
    }
}
