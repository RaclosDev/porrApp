package com.porra.mundial.controller;

import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.service.LeaderboardService;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.StandingsService;
import com.porra.mundial.service.SyncService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StandingsController.class)
@AutoConfigureMockMvc(addFilters = false)
class StandingsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StandingsService standingsService;

    @MockBean
    private SyncService syncService;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @MockBean
    private PredictionRepository predictionRepository;

    @MockBean
    private PredictionService predictionService;

    @MockBean
    private LeaderboardService leaderboardService;

    @MockBean
    private com.porra.mundial.service.GroupService groupService;

    @Test
    void getStandings_ReturnsGroupedStandingsMap() throws Exception {
        Map<String, Map<String, Map<String, Integer>>> responseMap = new HashMap<>();
        Map<String, Map<String, Integer>> groupA = new HashMap<>();
        Map<String, Integer> spainStats = new HashMap<>();
        spainStats.put("pts", 9);
        spainStats.put("diff", 5);
        spainStats.put("gls", 6);
        spainStats.put("mp", 3);
        groupA.put("España", spainStats);
        responseMap.put("A", groupA);

        Mockito.when(standingsService.getOfficialPoints()).thenReturn(responseMap);

        mockMvc.perform(get("/api/standings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.A").exists())
                .andExpect(jsonPath("$.A.España.pts").value(9))
                .andExpect(jsonPath("$.A.España.diff").value(5));
    }

    @Test
    void exportStandingsCsv_ReturnsCsvContent() throws Exception {
        Mockito.when(leaderboardService.exportLeaderboardCsv(1L))
                .thenReturn("Posicion,Participante,Nombre Porra,Puntos Totales\n1,Carlos,Mi Porra,100\n");

        mockMvc.perform(get("/api/standings/export/csv?groupId=1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"clasificacion-porra.csv\""))
                .andExpect(content().contentType("text/csv;charset=UTF-8"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Carlos")));
    }
}
