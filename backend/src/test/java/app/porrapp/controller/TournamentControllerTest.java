package app.porrapp.controller;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.TeamOddsDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.tournament.GroupTournamentService;
import org.junit.jupiter.api.BeforeEach;
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

@WebMvcTest(TournamentController.class)
@AutoConfigureMockMvc(addFilters = false)
class TournamentControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @MockitoBean
    private app.porrapp.config.JwtUtil jwtUtil;

    @MockitoBean
    private GroupTournamentService tournaments;

    @Autowired
    private MockMvc mockMvc;

    private final Competition tournament = Competition.builder().id(7L).name("Mundial")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();

    @BeforeEach
    void setUp() {
        Mockito.when(tournaments.tournament(7L)).thenReturn(tournament);
        Mockito.when(tournaments.tournament(5L)).thenThrow(BusinessException.notFound("Torneo no encontrado"));
    }

    @Test
    void everyReadIsOfTheTournamentAsked() throws Exception {
        Mockito.when(tournaments.groupPoints(tournament)).thenReturn(Map.of("A", Map.of("España", Map.of("pts", 9))));
        Mockito.when(tournaments.groupOdds(tournament))
                .thenReturn(Map.of("E", List.of(new TeamOddsDTO("España", 4.5, 1.2, 7.0))));
        PredictionDataDTO bracket = new PredictionDataDTO();
        bracket.setChampion("España");
        Mockito.when(tournaments.officialBracket(tournament)).thenReturn(bracket);
        Mockito.when(tournaments.scorers(tournament))
                .thenReturn(List.of(new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 8, "F", "1", "Francia", "")));

        mockMvc.perform(get("/api/competitions/7/tournament/standings"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.A.España.pts").value(9));
        mockMvc.perform(get("/api/competitions/7/tournament/group-odds"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.E[0].name").value("España"));
        mockMvc.perform(get("/api/competitions/7/tournament/official-bracket"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.champion").value("España"));
        mockMvc.perform(get("/api/competitions/7/tournament/scorers"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].goals").value(8));
    }

    @Test
    void aCompetitionThatIsNotAGroupTournamentHasNone() throws Exception {
        for (String read : List.of("standings", "group-odds", "official-bracket", "scorers")) {
            mockMvc.perform(get("/api/competitions/5/tournament/" + read)).andExpect(status().isNotFound());
        }
    }
}
