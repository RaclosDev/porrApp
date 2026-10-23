package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.porra.mundial.model.Bet;

import com.porra.mundial.service.PredictionService;

import org.junit.jupiter.api.Test;

import org.mockito.Mockito;

import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;

import org.springframework.boot.test.mock.mockito.MockBean;

import org.springframework.http.MediaType;

import com.porra.mundial.dto.BetDataDTO;

import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;

import java.util.List;

import java.util.Map;

import org.springframework.security.core.Authentication;

import org.springframework.security.core.context.SecurityContext;

import org.springframework.security.core.context.SecurityContextHolder;

import static org.mockito.ArgumentMatchers.any;

import static org.mockito.ArgumentMatchers.anyString;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BetController.class)

@AutoConfigureMockMvc(addFilters = false)

class BetControllerTest {

    @Autowired

    private MockMvc mockMvc;

    @Autowired

    private ObjectMapper objectMapper;

    @MockBean

    private PredictionService betService;

    @MockBean

    private com.porra.mundial.config.JwtUtil jwtUtil;

    @MockBean

    private com.porra.mundial.service.WebSocketService webSocketService;

    @Test

    void getAllBets_ReturnsList() throws Exception {

        com.porra.mundial.dto.BetResponseDTO betDto = com.porra.mundial.dto.BetResponseDTO.builder()

                .key("1")

                .participantName("Juan")

                .build();

        Mockito.when(betService.getAllBets()).thenReturn(List.of());

        Mockito.when(betService.toBetDtoList(any())).thenReturn(List.of(betDto));

        mockMvc.perform(get("/api/bets"))

                .andExpect(status().isOk())

                .andExpect(jsonPath("$[0].participantName").value("Juan"));

    }

    @Test

    void createBet_SavesAndReturnsBet() throws Exception {

        Authentication authentication = Mockito.mock(Authentication.class);

        Mockito.when(authentication.getName()).thenReturn("Ana");

        SecurityContext securityContext = Mockito.mock(SecurityContext.class);

        Mockito.when(securityContext.getAuthentication()).thenReturn(authentication);

        SecurityContextHolder.setContext(securityContext);

        BetDataDTO body = new BetDataDTO();

        body.setUser("Ana");

        body.setBet("My Bet");

        body.setGroups(Map.of("A", List.of("Team1", "Team2"))); // @NotEmpty

        body.setR32(List.of(List.of("Team1", "Team2"))); // @NotNull

        body.setR16(List.of(List.of("Team1", "Team2"))); // @NotNull

        Bet savedBet = Bet.builder()

                .id(2L)

                .user(com.porra.mundial.model.UserAccount.builder().participantName("Ana").build())

                .build();

        Mockito.when(betService.createBet(anyString(), anyString(), any(BetDataDTO.class), any())).thenReturn(savedBet);

        mockMvc.perform(post("/api/bets")

                        .contentType(MediaType.APPLICATION_JSON)

                        .content(objectMapper.writeValueAsString(body)))

                .andExpect(status().isOk())

                .andExpect(jsonPath("$.id").value(2))

                .andExpect(jsonPath("$.participantName").value("Ana"));

    }

    @Test

    void deleteBet_ReturnsOk() throws Exception {

        mockMvc.perform(delete("/api/bets/1"))

                .andExpect(status().isOk());

                

        Mockito.verify(betService).deleteBet(Mockito.eq(1L), any());

    }

    @Test

    void deleteBet_Forbidden_WhenNotOwner() throws Exception {

        Mockito.doThrow(new SecurityException("No tienes permiso para modificar o eliminar esta apuesta."))

                .when(betService).deleteBet(Mockito.eq(99L), any());

        mockMvc.perform(delete("/api/bets/99"))

                .andExpect(status().isForbidden())

                .andExpect(jsonPath("$.error").value("No tienes permiso para modificar o eliminar esta apuesta."));

    }

    @Test

    void updateBet_Forbidden_WhenNotOwner() throws Exception {
        BetDataDTO body = new BetDataDTO();
        body.setUser("Hacker");
        body.setBet("Stolen Bet");
        body.setGroups(Map.of("A", List.of("Team1", "Team2")));
        body.setR32(List.of(List.of("Team1", "Team2")));
        body.setR16(List.of(List.of("Team1", "Team2")));
        body.setR32(List.of(List.of("Team1", "Team2")));
        body.setR16(List.of(List.of("Team1", "Team2")));

        Mockito.doThrow(new SecurityException("No tienes permiso para modificar o eliminar esta apuesta."))
                .when(betService).updateBet(Mockito.eq(99L), any(), any(), any(), any());

        mockMvc.perform(put("/api/bets/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No tienes permiso para modificar o eliminar esta apuesta."));

    }

    @Test

    void markAsPaid_Forbidden_WhenNotGroupAdmin() throws Exception {

        Mockito.doThrow(new SecurityException("Solo el administrador del grupo puede marcar la apuesta como pagada."))

                .when(betService).markAsPaid(Mockito.eq(99L), any());

        mockMvc.perform(put("/api/bets/99/pay"))

                .andExpect(status().isForbidden())

                .andExpect(jsonPath("$.error").value("Solo el administrador del grupo puede marcar la apuesta como pagada."));

    }


    @Test
    void getAllPredictions_ViaAlias_ReturnsList() throws Exception {
        com.porra.mundial.dto.BetResponseDTO betDto = com.porra.mundial.dto.BetResponseDTO.builder()
                .key("1")
                .participantName("Carlos")
                .build();

        Mockito.when(betService.getAllBets()).thenReturn(List.of());
        Mockito.when(betService.toBetDtoList(any())).thenReturn(List.of(betDto));

        mockMvc.perform(get("/api/predictions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].participantName").value("Carlos"));
    }

    @Test
    void createPrediction_ViaAlias_SavesAndReturnsBet() throws Exception {
        Authentication authentication = Mockito.mock(Authentication.class);
        Mockito.when(authentication.getName()).thenReturn("Carlos");
        SecurityContext securityContext = Mockito.mock(SecurityContext.class);
        Mockito.when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

        BetDataDTO body = new BetDataDTO();
        body.setUser("Carlos");
        body.setBet("Mi Porra");
        body.setGroups(Map.of("A", List.of("Team1", "Team2")));
        body.setR32(List.of(List.of("Team1", "Team2")));
        body.setR16(List.of(List.of("Team1", "Team2")));

        Bet mockBet = Bet.builder()
                .id(15L)
                .user(com.porra.mundial.model.UserAccount.builder().participantName("Carlos").build())
                .betName("Mi Porra")
                .build();

        Mockito.when(betService.createBet(anyString(), anyString(), any(BetDataDTO.class), any())).thenReturn(mockBet);

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(15))
                .andExpect(jsonPath("$.participantName").value("Carlos"));
    }

    @Test
    void deletePrediction_ViaAlias_Forbidden_WhenNotOwner() throws Exception {
        Mockito.doThrow(new SecurityException("No tienes permiso para modificar o eliminar esta apuesta."))
                .when(betService).deleteBet(Mockito.eq(99L), any());

        mockMvc.perform(delete("/api/predictions/99"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("No tienes permiso para modificar o eliminar esta apuesta."));
    }

    @Test
    void markAsPaidPrediction_ViaAlias_Forbidden_WhenNotGroupAdmin() throws Exception {
        Mockito.doThrow(new SecurityException("Solo el administrador del grupo puede marcar la apuesta como pagada."))
                .when(betService).markAsPaid(Mockito.eq(99L), any());

        mockMvc.perform(put("/api/predictions/99/pay"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Solo el administrador del grupo puede marcar la apuesta como pagada."));
    }
}
