package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.WebSocketService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PredictionService predictionService;

    @MockBean
    private com.porra.mundial.service.GroupService groupService;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @MockBean
    private com.porra.mundial.service.LeaderboardService leaderboardService;

    @MockBean
    private WebSocketService webSocketService;

    @Test
    void getAllPredictions_ReturnsList() throws Exception {
        PredictionResponseDTO dto = PredictionResponseDTO.builder()
                .key("1")
                .participantName("Juan")
                .build();

        Mockito.when(predictionService.getAllPredictions()).thenReturn(List.of());
        Mockito.when(predictionService.toPredictionDtoList(any(), any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/predictions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].participantName").value("Juan"));
    }

    @Test
    void createPrediction_SavesAndReturnsPrediction() throws Exception {
        Authentication authentication = Mockito.mock(Authentication.class);
        Mockito.when(authentication.getName()).thenReturn("Ana");
        SecurityContext securityContext = Mockito.mock(SecurityContext.class);
        Mockito.when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

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

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.participantName").value("Ana"));
    }

    @Test
    void deletePrediction_ReturnsOk() throws Exception {
        mockMvc.perform(delete("/api/predictions/1"))
                .andExpect(status().isOk());

        Mockito.verify(predictionService).deletePrediction(Mockito.eq(1L), any());
    }

    @Test
    void deletePrediction_Forbidden_WhenNotOwner() throws Exception {
        Mockito.doThrow(new SecurityException("No tienes permiso para modificar o eliminar este pronostico."))
                .when(predictionService).deletePrediction(Mockito.eq(99L), any());

        mockMvc.perform(delete("/api/predictions/99"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No tienes permiso para modificar o eliminar este pronostico."));
    }

    @Test
    void updatePrediction_Forbidden_WhenNotOwner() throws Exception {
        PredictionDataDTO body = new PredictionDataDTO();
        body.setUser("Hacker");
        body.setPrediction("Stolen Prediction");
        body.setGroups(Map.of("A", List.of("Team1", "Team2")));
        body.setR32(List.of(List.of("Team1", "Team2")));
        body.setR16(List.of(List.of("Team1", "Team2")));

        Mockito.doThrow(new SecurityException("No tienes permiso para modificar o eliminar este pronostico."))
                .when(predictionService).updatePrediction(Mockito.eq(99L), any(), any(), any(), any());

        mockMvc.perform(put("/api/predictions/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No tienes permiso para modificar o eliminar este pronostico."));
    }

    @Test
    void markAsPaid_Forbidden_WhenNotGroupAdmin() throws Exception {
        Mockito.doThrow(new SecurityException("Solo el administrador del grupo puede marcar el pronostico como pagado."))
                .when(predictionService).markAsPaid(Mockito.eq(99L), any());

        mockMvc.perform(put("/api/predictions/99/pay"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Solo el administrador del grupo puede marcar el pronostico como pagado."));
    }

    @Test
    void getAllBets_LegacyRoute_ReturnsList() throws Exception {
        PredictionResponseDTO dto = PredictionResponseDTO.builder()
                .key("1")
                .participantName("Carlos")
                .build();

        Mockito.when(predictionService.getPredictionsByGroupId(1L)).thenReturn(List.of());
        Mockito.when(predictionService.toPredictionDtoList(any(), any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/bets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].participantName").value("Carlos"));
    }

    @Test
    void getAllPredictions_Forbidden_WhenNotMemberOfPrivateGroup() throws Exception {
        Mockito.when(groupService.isUserMemberOrAdmin(Mockito.eq(6L), any())).thenReturn(false);

        mockMvc.perform(get("/api/predictions?groupId=6"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No perteneces a esta liga privada"));
    }
}
