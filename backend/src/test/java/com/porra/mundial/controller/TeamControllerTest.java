package com.porra.mundial.controller;

import com.porra.mundial.service.TeamService;
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
                .thenReturn(Map.of("E", List.of(Map.of("name", "Spain", "winOdds", 4.5))));

        mockMvc.perform(get("/api/teams/odds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.E[0].name").value("Spain"))
                .andExpect(jsonPath("$.E[0].winOdds").value(4.5));
    }
}
