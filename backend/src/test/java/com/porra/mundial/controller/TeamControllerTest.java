package com.porra.mundial.controller;

import com.porra.mundial.model.Team;
import com.porra.mundial.service.TeamService;
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
    void getAllTeams_ReturnsList() throws Exception {
        Team t = Team.builder().id(1L).name("España").groupName("E").build();
        Mockito.when(teamService.getAllTeams()).thenReturn(List.of(t));

        mockMvc.perform(get("/api/teams"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("España"))
                .andExpect(jsonPath("$[0].groupName").value("E"));
    }
}
