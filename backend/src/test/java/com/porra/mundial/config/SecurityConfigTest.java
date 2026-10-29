package com.porra.mundial.config;

import com.porra.mundial.controller.TopScorerController;
import com.porra.mundial.service.TopScorerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica las reglas de acceso de {@link SecurityConfig} con los filtros reales activos.
 */
@WebMvcTest(TopScorerController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class})
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TopScorerService topScorerService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    void publicReadsAreAllowedWithoutLogin() throws Exception {
        when(topScorerService.getTopScorers()).thenReturn(List.of());
        mockMvc.perform(get("/api/scorers")).andExpect(status().isOk());
    }

    @Test
    void writesUnderPublicPathsRequireLogin() throws Exception {
        mockMvc.perform(post("/api/scorers/refresh")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/matches")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/groups/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void privateEndpointsRequireLogin() throws Exception {
        mockMvc.perform(get("/api/groups/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/predictions/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/sync")).andExpect(status().isUnauthorized());
    }
}
