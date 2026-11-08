package com.porra.mundial.controller;

import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Fight;
import com.porra.mundial.model.FightMethod;
import com.porra.mundial.model.Team;
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
import java.util.Map;

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

    @Test
    void ufcFightsCarryHowTheyEndedAndOtherMatchesNoFightField() throws Exception {
        Team red = Team.builder().id(1L).name("Keiichiro Nakamura").build();
        Team blue = Team.builder().id(2L).name("Ollie Schmid").build();
        Match bout = Match.builder().id(11L).homeTeam(red).awayTeam(blue).winnerTeam(blue)
                .homeScore(0).awayScore(1).finished(true).round("UFC Fight Night").build();
        Match football = Match.builder().id(12L).homeScore(2).awayScore(1).finished(true).build();
        Fight fight = Fight.builder().matchId(11L).eventExternalId("600061268").resultMethod(FightMethod.SUBMISSION)
                .resultDetail("Submission - Rear Naked Choke").resultRound(2).resultClock("3:12").build();
        List<Match> matches = List.of(bout, football);
        Mockito.when(matchService.getMatchesByCompetition(5L)).thenReturn(matches);
        Mockito.when(matchService.publicOnly(matches)).thenReturn(matches);
        Mockito.when(matchService.fightsOf(matches)).thenReturn(Map.of(11L, fight));

        mockMvc.perform(get("/api/matches?competitionId=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fight.winner").value("2"))
                .andExpect(jsonPath("$[0].fight.resultMethod").value("SUBMISSION"))
                .andExpect(jsonPath("$[0].fight.resultDetail").value("Submission - Rear Naked Choke"))
                .andExpect(jsonPath("$[0].fight.resultRound").value(2))
                .andExpect(jsonPath("$[0].fight.resultClock").value("3:12"))
                .andExpect(jsonPath("$[1].fight").doesNotExist());
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
        Mockito.when(matchService.getAllMatches()).thenReturn(List.of(privateMatch));
        Mockito.when(matchService.publicOnly(List.of(privateMatch))).thenReturn(List.of());

        mockMvc.perform(get("/api/matches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
