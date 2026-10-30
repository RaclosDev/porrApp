package com.porra.mundial.controller;

import com.porra.mundial.service.TeamService;
import com.porra.mundial.dto.TeamOddsDTO;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TeamController.class)
@AutoConfigureMockMvc(addFilters = false)
class TeamControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TeamService teamService;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @Test
    void getGroupOdds_ReturnsTeamsGroupedByGroup() throws Exception {
        Mockito.when(teamService.getGroupOdds())
                .thenReturn(Map.of("E", List.of(new TeamOddsDTO("España", 4.5, 1.2, 7.0))));

        mockMvc.perform(get("/api/teams/odds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.E[0].name").value("España"))
                .andExpect(jsonPath("$.E[0].win").value(4.5))
                .andExpect(jsonPath("$.E[0].qualify").value(1.2))
                .andExpect(jsonPath("$.E[0].outright").value(7.0));
    }
}
