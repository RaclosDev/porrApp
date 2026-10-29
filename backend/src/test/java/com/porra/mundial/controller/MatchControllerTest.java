package com.porra.mundial.controller;

import com.porra.mundial.service.MatchService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatchController.class)
@AutoConfigureMockMvc(addFilters = false)
class MatchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MatchService matchService;

    @MockitoBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @Test
    void getRadarMatches_ReturnsRadarMap() throws Exception {
        Mockito.when(matchService.getLiveMatches(Mockito.any())).thenReturn(List.of());
        Mockito.when(matchService.getLiveMatches()).thenReturn(List.of());
        Mockito.when(matchService.getLastMatches(Mockito.eq(5), Mockito.any())).thenReturn(List.of());
        Mockito.when(matchService.getLastMatches(5)).thenReturn(List.of());
        Mockito.when(matchService.getNextMatches(Mockito.eq(5), Mockito.any())).thenReturn(List.of());
        Mockito.when(matchService.getNextMatches(5)).thenReturn(List.of());

        mockMvc.perform(get("/api/matches/radar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.live").isArray());
    }

    @Test
    void getRadarMatches_WithCompetitionId_PassesCompetitionIdToService() throws Exception {
        Mockito.when(matchService.getLiveMatches(Mockito.eq(1L))).thenReturn(List.of());
        Mockito.when(matchService.getLastMatches(Mockito.eq(5), Mockito.eq(1L))).thenReturn(List.of());
        Mockito.when(matchService.getNextMatches(Mockito.eq(5), Mockito.eq(1L))).thenReturn(List.of());

        mockMvc.perform(get("/api/matches/radar?competitionId=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.live").isArray());
    }
}
