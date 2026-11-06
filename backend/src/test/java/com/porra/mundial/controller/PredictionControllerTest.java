package com.porra.mundial.controller;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.repository.UserAccountRepository;

import tools.jackson.databind.ObjectMapper;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.prediction.PredictionService;
import com.porra.mundial.service.notification.WebSocketService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PredictionController.class)
@AutoConfigureMockMvc(addFilters = false)
class PredictionControllerTest {

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private PredictionService predictionService;

    @MockitoBean
    private com.porra.mundial.service.league.LeagueService leagueService;

    @MockitoBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @MockitoBean
    private com.porra.mundial.service.prediction.LeaderboardService leaderboardService;

    @MockitoBean
    private WebSocketService webSocketService;

    @Test
    void getAllPredictions_ReturnsList() throws Exception {
        PredictionResponseDTO dto = PredictionResponseDTO.builder()
                .key("1")
                .participantName("Juan")
                .build();

        List<Prediction> predictions = List.of(Prediction.builder().id(1L).build());
        Mockito.when(predictionService.getPredictionsByGroupId(7L)).thenReturn(predictions);
        Mockito.when(predictionService.toPredictionDtoList(predictions, null)).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/predictions").param("groupId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].participantName").value("Juan"));
        Mockito.verify(leagueService).assertCanView(7L, null);
        Mockito.verify(predictionService).getPredictionsByGroupId(7L);
    }

    @Test
    void getAllPredictions_RequiresALeague() throws Exception {
        mockMvc.perform(get("/api/predictions")).andExpect(status().isBadRequest());
        Mockito.verifyNoInteractions(predictionService);
    }

    @Test
    void createPrediction_SavesAndReturnsPrediction() throws Exception {
        PredictionDataDTO body = new PredictionDataDTO();
        body.setUser("Ana");
        body.setPrediction("Mi Porra");
        body.setGroups(Map.of("A", List.of("Team1", "Team2")));
        body.setR32(List.of(List.of("Team1", "Team2")));
        body.setR16(List.of(List.of("Team1", "Team2")));

        Prediction saved = Prediction.builder()
                .id(2L)
                .user(UserAccount.builder().participantName("Ana").build())
                .name("Mi Porra")
                .build();

        Mockito.when(predictionService.createPrediction(anyString(), anyString(), any(PredictionDataDTO.class), any())).thenReturn(saved);

        mockMvc.perform(post("/api/predictions").param("groupId", "7")
                        .principal(() -> "ana@test.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.participantName").value("Ana"));
    }

    @Test
    void getAllPredictions_Forbidden_WhenNotMemberOfPrivateGroup() throws Exception {
        Mockito.doThrow(BusinessException.forbidden("No perteneces a esta liga privada"))
                .when(leagueService).assertCanView(Mockito.eq(6L), any());

        mockMvc.perform(get("/api/predictions?groupId=6"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No perteneces a esta liga privada"));
    }
}
