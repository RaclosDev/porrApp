package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.dto.ManualMatchOverrideDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Team;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.SyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SyncService syncService;

    @MockBean
    private PredictionService predictionService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("GET /api/admin/sync/status devuelve overview del servicio")
    void getSyncStatusReturnsOverview() throws Exception {
        Mockito.when(syncService.getSyncOverview()).thenReturn(Map.of(
                "status", "SUCCESS",
                "defaultProvider", "ESPN",
                "availableProviders", List.of("ESPN", "API-Football")
        ));

        mockMvc.perform(get("/api/admin/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.defaultProvider").value("ESPN"))
                .andExpect(jsonPath("$.availableProviders[0]").value("ESPN"));
    }

    @Test
    @DisplayName("POST /api/admin/sync ejecuta sincronización de competición")
    void syncCompetitionExecutesSync() throws Exception {
        Mockito.when(syncService.syncCompetition(eq(1L))).thenReturn(Map.of(
                "status", "ok",
                "matchesUpdated", 10
        ));

        mockMvc.perform(post("/api/admin/sync?competitionId=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.matchesUpdated").value(10));
    }

    @Test
    @DisplayName("PUT /api/admin/matches/{id}/manual-result actualiza marcador de partido")
    void overrideMatchResultUpdatesScore() throws Exception {
        Team home = new Team();
        home.setName("España");
        Team away = new Team();
        away.setName("Francia");

        Match match = new Match();
        match.setId(42L);
        match.setHomeTeam(home);
        match.setAwayTeam(away);
        match.setHomeScore(2);
        match.setAwayScore(1);
        match.setStatus(MatchStatusNormalized.FINISHED);
        match.setFinished(true);

        Mockito.when(syncService.overrideMatchResult(eq(42L), eq(2), eq(1), eq(MatchStatusNormalized.FINISHED), any()))
                .thenReturn(match);

        ManualMatchOverrideDTO dto = ManualMatchOverrideDTO.builder()
                .homeScore(2)
                .awayScore(1)
                .status(MatchStatusNormalized.FINISHED)
                .build();

        mockMvc.perform(put("/api/admin/matches/42/manual-result")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.homeScore").value(2))
                .andExpect(jsonPath("$.awayScore").value(1))
                .andExpect(jsonPath("$.status").value("FINISHED"));
    }

    @Test
    @DisplayName("PUT /api/admin/matches/{id}/manual-result falla con 400 si faltan campos obligatorios")
    void overrideMatchResultFailsValidation() throws Exception {
        ManualMatchOverrideDTO invalidDto = new ManualMatchOverrideDTO();

        mockMvc.perform(put("/api/admin/matches/42/manual-result")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDto)))
                .andExpect(status().isBadRequest());
    }
}
