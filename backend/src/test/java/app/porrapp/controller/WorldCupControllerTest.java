package app.porrapp.controller;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.TeamOddsDTO;
import app.porrapp.model.Competition;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.tournament.GroupTournamentService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WorldCupController.class)
@AutoConfigureMockMvc(addFilters = false)
class WorldCupControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @MockitoBean
    private app.porrapp.config.JwtUtil jwtUtil;

    @MockitoBean
    private GroupTournamentService tournaments;

    @Autowired
    private MockMvc mockMvc;

    private final Competition worldCup = Competition.builder().id(2L).name("Mundial")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();

    private void givenTheWorldCup() {
        Mockito.when(tournaments.tournament(Competition.WORLD_CUP_EXTERNAL_ID)).thenReturn(Optional.of(worldCup));
    }

    @Test
    void standingsAreTheWorldCupGroups() throws Exception {
        givenTheWorldCup();
        Mockito.when(tournaments.groupPoints(worldCup))
                .thenReturn(Map.of("A", Map.of("España", Map.of("pts", 9, "diff", 5))));

        mockMvc.perform(get("/api/world-cup/standings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.A.España.pts").value(9))
                .andExpect(jsonPath("$.A.España.diff").value(5));
    }

    @Test
    void groupOddsComeByGroup() throws Exception {
        givenTheWorldCup();
        Mockito.when(tournaments.groupOdds(worldCup))
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
        givenTheWorldCup();
        PredictionDataDTO bracket = new PredictionDataDTO();
        bracket.setChampion("España");
        Mockito.when(tournaments.officialBracket(worldCup)).thenReturn(bracket);
        Mockito.when(tournaments.scorers(worldCup)).thenReturn(List.of());

        mockMvc.perform(get("/api/world-cup/official-bracket")).andExpect(status().isOk())
                .andExpect(jsonPath("$.champion").value("España"));
        mockMvc.perform(get("/api/world-cup/scorers")).andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void withoutTheWorldCupEveryRouteAnswersEmpty() throws Exception {
        Mockito.when(tournaments.tournament(Competition.WORLD_CUP_EXTERNAL_ID)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/world-cup/standings")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/world-cup/group-odds")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/world-cup/scorers")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/world-cup/official-bracket")).andExpect(status().isOk());
    }

    @Test
    void theOldGlobalPathsAreGone() throws Exception {
        mockMvc.perform(get("/api/standings")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/teams/odds")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/scorers")).andExpect(status().isNotFound());
    }
}
