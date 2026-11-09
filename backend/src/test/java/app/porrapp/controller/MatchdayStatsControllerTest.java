package app.porrapp.controller;

import app.porrapp.exception.BusinessException;
import app.porrapp.repository.UserAccountRepository;

import app.porrapp.dto.MatchVotersDTO;
import app.porrapp.dto.MatchdayStatsDTO;
import app.porrapp.dto.MatchdayStatsDTO.MatchStats;
import app.porrapp.dto.MatchdayStatsDTO.ScoreCount;
import app.porrapp.service.prediction.MatchdayStatsService;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatchdayStatsController.class)
@AutoConfigureMockMvc(addFilters = false)
class MatchdayStatsControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MatchdayStatsService matchdayStatsService;

    @MockitoBean
    private app.porrapp.config.JwtUtil jwtUtil;

    private static final Principal USER = () -> "user@test.com";

    @Test
    @DisplayName("GET /api/predictions/matchday/stats devuelve el reparto de cada partido")
    void returnsMatchStats() throws Exception {
        MatchStats match = new MatchStats(7L, "Jornada 3", AppTime.fromLocal(LocalDateTime.of(2026, 10, 25, 21, 0)),
                "Real Madrid", "Barcelona", null, null, true, false, 2, 1,
                5, 3, 1, 1, List.of(new ScoreCount(2, 1, 2)), 2, 3, List.of());
        Mockito.when(matchdayStatsService.getStats("user@test.com", 10L))
                .thenReturn(new MatchdayStatsDTO(8, List.of(match)));

        mockMvc.perform(get("/api/predictions/matchday/stats?groupId=10").principal(USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members").value(8))
                .andExpect(jsonPath("$.matches[0].matchId").value(7))
                .andExpect(jsonPath("$.matches[0].round").value("Jornada 3"))
                .andExpect(jsonPath("$.matches[0].finished").value(true))
                .andExpect(jsonPath("$.matches[0].homeWins").value(3))
                .andExpect(jsonPath("$.matches[0].topScores[0].home").value(2))
                .andExpect(jsonPath("$.matches[0].topScores[0].count").value(2))
                .andExpect(jsonPath("$.matches[0].exactHits").value(2));
    }

    @Test
    @DisplayName("Quien no es miembro de la liga recibe 403")
    void forbiddenForNonMembers() throws Exception {
        Mockito.when(matchdayStatsService.getStats(isNull(), eq(10L)))
                .thenThrow(BusinessException.forbidden("No perteneces a esta liga privada"));

        mockMvc.perform(get("/api/predictions/matchday/stats?groupId=10"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No perteneces a esta liga privada"));
    }

    @Test
    @DisplayName("GET /api/predictions/matchday/stats/voters devuelve quién ha votado cada signo")
    void returnsVoters() throws Exception {
        Mockito.when(matchdayStatsService.getVoters("user@test.com", 10L, List.of(7L, 8L)))
                .thenReturn(List.of(new MatchVotersDTO(7L,
                        List.of(new MatchVotersDTO.Voter(2L, "Ana", "ana.png")), List.of(), List.of())));

        mockMvc.perform(get("/api/predictions/matchday/stats/voters?groupId=10&matchIds=7,8").principal(USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].matchId").value(7))
                .andExpect(jsonPath("$[0].home[0].name").value("Ana"))
                .andExpect(jsonPath("$[0].home[0].avatarUrl").value("ana.png"))
                .andExpect(jsonPath("$[0].draw").isEmpty());
    }

    @Test
    @DisplayName("GET /api/predictions/matchday/stats/participants devuelve quién ha participado")
    void returnsParticipants() throws Exception {
        Mockito.when(matchdayStatsService.getParticipants("user@test.com", 10L, List.of(7L, 8L)))
                .thenReturn(List.of(new MatchVotersDTO.Voter(2L, "Ana", "ana.png")));

        mockMvc.perform(get("/api/predictions/matchday/stats/participants?groupId=10&matchIds=7,8").principal(USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value(2))
                .andExpect(jsonPath("$[0].name").value("Ana"))
                .andExpect(jsonPath("$[0].avatarUrl").value("ana.png"))
                .andExpect(jsonPath("$[0].home").doesNotExist());
    }
}
