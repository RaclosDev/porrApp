package com.porra.mundial.controller;

import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ScoringController.class)
@AutoConfigureMockMvc(addFilters = false)
class ScoringControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MatchScoringCalculator matchScoringCalculator;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @Test
    @DisplayName("GET /api/rules devuelve el reglamento por defecto")
    void getActiveRules() throws Exception {
        mockMvc.perform(get("/api/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.championPoints").value(200))
                .andExpect(jsonPath("$.exactScorePoints").value(5))
                .andExpect(jsonPath("$.groupQualifierPoints").value(10));
    }

    @Test
    @DisplayName("GET /api/rules/preview simula puntuacion de un partido con explicacion")
    void previewMatchScore() throws Exception {
        when(matchScoringCalculator.calculate(eq(2), eq(1), eq(2), eq(1), any(ScoringRuleSet.class)))
                .thenReturn(new MatchScoreResult(3, true, true, true, "Resultado exacto 2-1 (3 pts)"));

        mockMvc.perform(get("/api/rules/preview")
                        .param("predHome", "2")
                        .param("predAway", "1")
                        .param("actualHome", "2")
                        .param("actualAway", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPoints").value(3))
                .andExpect(jsonPath("$.exactScore").value(true))
                .andExpect(jsonPath("$.explanation").value("Resultado exacto 2-1 (3 pts)"));
    }
}
