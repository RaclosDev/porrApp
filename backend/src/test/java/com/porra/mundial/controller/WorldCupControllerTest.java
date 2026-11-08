package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TeamOddsDTO;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.tournament.OfficialResultsService;
import com.porra.mundial.service.tournament.StandingsService;
import com.porra.mundial.service.tournament.TeamService;
import com.porra.mundial.service.tournament.TopScorerService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WorldCupController.class)
@AutoConfigureMockMvc(addFilters = false)
class WorldCupControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @MockitoBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @MockitoBean
    private StandingsService standingsService;

    @MockitoBean
    private OfficialResultsService officialResultsService;

    @MockitoBean
    private TeamService teamService;

    @MockitoBean
    private TopScorerService topScorerService;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void standingsAreTheWorldCupGroups() throws Exception {
        Mockito.when(standingsService.getWorldCupGroupPoints())
                .thenReturn(Map.of("A", Map.of("España", Map.of("pts", 9, "diff", 5))));

        mockMvc.perform(get("/api/world-cup/standings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.A.España.pts").value(9))
                .andExpect(jsonPath("$.A.España.diff").value(5));
    }

    @Test
    void groupOddsComeByGroup() throws Exception {
        Mockito.when(teamService.getWorldCupGroupOdds())
                .thenReturn(Map.of("E", List.of(new TeamOddsDTO("España", 4.5, 1.2, 7.0))));

        mockMvc.perform(get("/api/world-cup/group-odds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.E[0].name").value("España"))
                .andExpect(jsonPath("$.E[0].win").value(4.5))
                .andExpect(jsonPath("$.E[0].qualify").value(1.2))
                .andExpect(jsonPath("$.E[0].outright").value(7.0));
    }

    @Test
    void officialBracketAndScorersAreTheWorldCupOnes() throws Exception {
        Mockito.when(officialResultsService.worldCupBracket()).thenReturn(new PredictionDataDTO());
        Mockito.when(topScorerService.getTopScorers()).thenReturn(List.of());

        mockMvc.perform(get("/api/world-cup/official-bracket")).andExpect(status().isOk());
        mockMvc.perform(get("/api/world-cup/scorers")).andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void theOldGlobalPathsAreGone() throws Exception {
        mockMvc.perform(get("/api/standings")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/teams/odds")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/scorers")).andExpect(status().isNotFound());
    }
}
