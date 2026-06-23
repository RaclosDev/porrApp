package com.porra.mundial.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PresenceController.class)
@AutoConfigureMockMvc(addFilters = false)
class PresenceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private com.porra.mundial.config.JwtUtil jwtUtil;

    @MockBean
    private com.porra.mundial.service.WebSocketService webSocketService;

    @MockBean
    private AppWebSocketHandler appWebSocketHandler;

    @MockBean
    private com.porra.mundial.repository.ConnectionLogRepository connectionLogRepository;

    @Test
    void getPresence_ReturnsActiveCount() throws Exception {
        // Al ser la primera vez, devolverá una lista vacía
        mockMvc.perform(get("/api/presence"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
