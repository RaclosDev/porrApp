package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Bet;
import com.porra.mundial.service.BetService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BetController.class)
class BetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BetService betService;

    @Test
    void getAllBets_ReturnsList() throws Exception {
        Map<String, Object> betDto = new HashMap<>();
        betDto.put("id", 1);
        betDto.put("participantName", "Juan");

        Mockito.when(betService.getAllBets()).thenReturn(List.of());
        Mockito.when(betService.toBetDtoList(any())).thenReturn(List.of(betDto));

        mockMvc.perform(get("/api/bets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].participantName").value("Juan"));
    }

    @Test
    void createBet_SavesAndReturnsBet() throws Exception {
        Map<String, String> body = new HashMap<>();
        body.put("participantName", "Ana");
        body.put("hash", "xyz");

        Bet savedBet = new Bet();
        savedBet.setId(2L);
        savedBet.setParticipantName("Ana");

        Mockito.when(betService.createBet("Ana", "Ana", "xyz")).thenReturn(savedBet);

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
