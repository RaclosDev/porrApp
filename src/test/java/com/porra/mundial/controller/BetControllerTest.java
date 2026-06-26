package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Bet;
import com.porra.mundial.service.BetService;
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

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
    private BetService betService;

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
        body.setGroups(new HashMap<>());
        body.setR16(new java.util.ArrayList<>());

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
                
        Mockito.verify(betService).deleteBet(1L);
    }
}
