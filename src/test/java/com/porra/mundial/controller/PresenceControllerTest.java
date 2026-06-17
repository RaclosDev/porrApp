package com.porra.mundial.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PresenceController.class)
class PresenceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getPresence_ReturnsActiveCount() throws Exception {
        // Al ser la primera vez, devolverá una lista vacía
        mockMvc.perform(get("/api/presence"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
