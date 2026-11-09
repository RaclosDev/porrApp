package app.porrapp.config;

import app.porrapp.controller.TournamentController;
import app.porrapp.service.tournament.GroupTournamentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;


import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica las reglas de acceso de {@link SecurityConfig} con los filtros reales activos.
 */
@WebMvcTest(TournamentController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
@org.springframework.test.context.TestPropertySource(properties = "app.metrics.token=" + SecurityConfigTest.METRICS_TOKEN)
class SecurityConfigTest {

    static final String METRICS_TOKEN = "token-de-metricas";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GroupTournamentService tournaments;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private app.porrapp.repository.UserAccountRepository userAccountRepository;

    @Test
    void publicReadsAreAllowedWithoutLogin() throws Exception {
        mockMvc.perform(get("/api/competitions/1/tournament/scorers")).andExpect(status().isOk());
        mockMvc.perform(get("/api/competitions/1/tournament/standings")).andExpect(status().isOk());
        mockMvc.perform(get("/api/competitions/1/tournament/group-odds")).andExpect(status().isOk());
        // Ruta pública sin controlador en este test: pasa la seguridad y llega al 404.
        mockMvc.perform(get("/api/groups/1")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/groups/1/scoring")).andExpect(status().isNotFound());
    }

    @Test
    void contentSecurityPolicyAllowsLocalImagePreviews() throws Exception {
        // La vista previa de una foto elegida es una URL blob: hasta que se sube.
        mockMvc.perform(get("/api/competitions/1/tournament/scorers"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Security-Policy", org.hamcrest.Matchers.containsString("img-src 'self' data: blob: https:")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Permissions-Policy", "camera=(), microphone=(), geolocation=()"));
    }

    @Test
    void healthProbeUsedByRailwayIsPublic() throws Exception {
        int status = mockMvc.perform(get("/actuator/health/liveness")).andReturn().getResponse().getStatus();
        org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
        org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
    }

    @Test
    void metricsNeedTheMetricsTokenAndOtherActuatorEndpointsAreClosed() throws Exception {
        mockMvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer otro"))
                .andExpect(status().isUnauthorized());
        // Con el token pasa la seguridad: sin actuator en este test llega al 404, no al 401.
        mockMvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer " + METRICS_TOKEN))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/actuator/env").header("Authorization", "Bearer " + METRICS_TOKEN))
                .andExpect(status().isUnauthorized()); // el token solo vale para /actuator/prometheus
        mockMvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void clientErrorReportsDoNotRequireLogin() throws Exception {
        // Sin el controlador en este test: pasa la seguridad y llega al 404, no al 401.
        mockMvc.perform(post("/api/client-errors").contentType("application/json").content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void writesUnderPublicPathsRequireLogin() throws Exception {
        mockMvc.perform(post("/api/competitions/1/tournament/scorers")).andExpect(status().isUnauthorized());
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
        mockMvc.perform(get("/api/groups/1/competition/teams")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/groups/1/competition/matches")).andExpect(status().isUnauthorized());
    }
}
