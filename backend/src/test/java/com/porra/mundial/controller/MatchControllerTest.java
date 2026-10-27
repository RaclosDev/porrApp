package com.porra.mundial.controller;

import com.porra.mundial.model.Team;
import com.porra.mundial.service.MatchService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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

    @MockBean
    private MatchService matchService;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @Test
    void getLiveMatches_ReturnsList() throws Exception {
        Team homeTeam = Team.builder().id(10L).name("España").build();
        Team awayTeam = Team.builder().id(20L).name("Francia").build();
        com.porra.mundial.model.Match matchEntity = com.porra.mundial.model.Match.builder()
                .id(100L)
                .homeTeam(homeTeam)
                .awayTeam(awayTeam)
                .build();
        
        Mockito.when(matchService.getLiveMatches()).thenReturn(List.of(matchEntity));

        mockMvc.perform(get("/api/matches/live"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100))
                .andExpect(jsonPath("$[0].home").value("España"));
    }

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
