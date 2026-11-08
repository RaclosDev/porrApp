package com.porra.mundial.controller;

import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;

import com.porra.mundial.service.tournament.MatchService;
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

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MatchService matchService;

    @MockitoBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @Test
    void withoutCompetitionThereAreNoMatches() throws Exception {
        // Antes devolvía los partidos de todas las competiciones mezclados.
        mockMvc.perform(get("/api/matches/radar")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/matches")).andExpect(status().isBadRequest());
        Mockito.verifyNoInteractions(matchService);
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

    @Test
    void privateCompetitionMatchesAreNotPublic() throws Exception {
        Mockito.doThrow(BusinessException.notFound("Competición no encontrada"))
                .when(matchService).requirePublicCompetition(9L);

        mockMvc.perform(get("/api/matches?competitionId=9"))
                .andExpect(status().isNotFound());

        Mockito.verify(matchService, Mockito.never()).getMatchesByCompetition(Mockito.any());
    }

    @Test
    void listsOnlyWhatTheServiceKeepsPublic() throws Exception {
        Match privateMatch = Match.builder()
                .competition(Competition.builder().id(9L).build()).build();
        Mockito.when(matchService.getMatchesByCompetition(9L)).thenReturn(List.of(privateMatch));
        Mockito.when(matchService.publicOnly(List.of(privateMatch))).thenReturn(List.of());

        mockMvc.perform(get("/api/matches?competitionId=9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
