package com.porra.mundial.controller;

import com.porra.mundial.repository.UserAccountRepository;

import com.porra.mundial.service.StandingsService;
import com.porra.mundial.service.OfficialResultsService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StandingsController.class)
@AutoConfigureMockMvc(addFilters = false)
class StandingsControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StandingsService standingsService;

    @MockitoBean
    private OfficialResultsService officialResultsService;

    @MockitoBean
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
