package com.porra.mundial.config;

import com.porra.mundial.controller.TopScorerController;
import com.porra.mundial.service.TopScorerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TopScorerService topScorerService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @Test
    void publicReadsAreAllowedWithoutLogin() throws Exception {
        when(topScorerService.getTopScorers()).thenReturn(List.of());
        mockMvc.perform(get("/api/scorers")).andExpect(status().isOk());
        // Ruta pública sin controlador en este test: pasa la seguridad y llega al 404.
        mockMvc.perform(get("/api/groups/1")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/groups/1/scoring")).andExpect(status().isNotFound());
    }

    @Test
    void contentSecurityPolicyAllowsLocalImagePreviews() throws Exception {
        when(topScorerService.getTopScorers()).thenReturn(List.of());
        // La vista previa de una foto elegida es una URL blob: hasta que se sube.
        mockMvc.perform(get("/api/scorers"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Security-Policy", org.hamcrest.Matchers.containsString("img-src 'self' data: blob: https:")));
    }

    @Test
    void healthProbeUsedByRailwayIsPublic() throws Exception {
        int status = mockMvc.perform(get("/actuator/health/liveness")).andReturn().getResponse().getStatus();
        org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
        org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
    }

    @Test
    void writesUnderPublicPathsRequireLogin() throws Exception {
        mockMvc.perform(post("/api/scorers/refresh")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/matches")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/groups/1")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/groups/1/scoring")).andExpect(status().isUnauthorized());
    }

    @Test
    void privateEndpointsRequireLogin() throws Exception {
        mockMvc.perform(get("/api/groups/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/predictions/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/sync")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/groups/1/members")).andExpect(status().isUnauthorized());
    }
}
