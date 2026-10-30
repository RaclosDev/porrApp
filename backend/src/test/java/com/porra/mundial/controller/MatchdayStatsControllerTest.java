package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayStatsDTO;
import com.porra.mundial.dto.MatchdayStatsDTO.MatchStats;
import com.porra.mundial.dto.MatchdayStatsDTO.ScoreCount;
import com.porra.mundial.service.MatchdayStatsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatchdayStatsController.class)
@AutoConfigureMockMvc(addFilters = false)
class MatchdayStatsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MatchdayStatsService matchdayStatsService;

    @MockitoBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    private static final Principal USER = () -> "user@test.com";

    @Test
    @DisplayName("GET /api/predictions/matchday/stats devuelve el reparto de cada partido")
    void returnsMatchStats() throws Exception {
        MatchStats match = new MatchStats(7L, "Jornada 3", LocalDateTime.of(2026, 10, 25, 21, 0),
                "Real Madrid", "Barcelona", null, null, true, false, 2, 1,
                5, 3, 1, 1, List.of(new ScoreCount(2, 1, 2)), 2, 3);
        Mockito.when(matchdayStatsService.getStats("user@test.com", 10L))
                .thenReturn(new MatchdayStatsDTO(8, List.of(match)));

        mockMvc.perform(get("/api/predictions/matchday/stats?groupId=10").principal(USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members").value(8))
                .andExpect(jsonPath("$.matches[0].matchId").value(7))
                .andExpect(jsonPath("$.matches[0].round").value("Jornada 3"))
                .andExpect(jsonPath("$.matches[0].finished").value(true))
                .andExpect(jsonPath("$.matches[0].homeWins").value(3))
                .andExpect(jsonPath("$.matches[0].topScores[0].home").value(2))
                .andExpect(jsonPath("$.matches[0].topScores[0].count").value(2))
                .andExpect(jsonPath("$.matches[0].exactHits").value(2));
    }

    @Test
    @DisplayName("Quien no es miembro de la liga recibe 403")
    void forbiddenForNonMembers() throws Exception {
        Mockito.when(matchdayStatsService.getStats(isNull(), eq(10L)))
                .thenThrow(new SecurityException("No perteneces a esta liga privada"));

        mockMvc.perform(get("/api/predictions/matchday/stats?groupId=10"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No perteneces a esta liga privada"));
    }
}
