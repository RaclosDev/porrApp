package com.porra.mundial.controller;

import com.porra.mundial.model.Team;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminController.class)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TeamRepository teamRepository;

    @Test
    void getTieBreakers_ReturnsCorrectMap() throws Exception {
        Team team = Team.builder().name("España").groupName("E").manualTieBreaker(2).build();
        Mockito.when(teamRepository.findAll()).thenReturn(List.of(team));

        mockMvc.perform(get("/api/admin/tiebreakers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.E.España").value(2));
    }

    @Test
    void bumpUp_IncrementsTieBreaker_WhenTeamExists() throws Exception {
        Team team = Team.builder().name("España").manualTieBreaker(0).build();
        Mockito.when(teamRepository.findByName("España")).thenReturn(Optional.of(team));

        mockMvc.perform(post("/api/admin/bump-up").param("teamName", "España"))
                .andExpect(status().isOk())
                .andExpect(content().string("Éxito: España subió en el desempate manual (+1)."));

        Mockito.verify(teamRepository).save(any(Team.class));
    }

    @Test
    void bumpUp_ReturnsError_WhenTeamNotFound() throws Exception {
        Mockito.when(teamRepository.findByName(anyString())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/admin/bump-up").param("teamName", "Narnia"))
                .andExpect(status().isOk())
                .andExpect(content().string("Error: Equipo no encontrado."));
    }
}
