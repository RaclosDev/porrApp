package com.porra.mundial.controller;

import com.porra.mundial.service.StandingsService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StandingsController.class)
@AutoConfigureMockMvc(addFilters = false)
class StandingsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StandingsService standingsService;

    @MockBean
    private com.porra.mundial.service.SyncService syncService;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

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
}
