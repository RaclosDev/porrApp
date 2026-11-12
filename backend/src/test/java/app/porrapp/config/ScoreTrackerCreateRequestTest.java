package app.porrapp.config;

import app.porrapp.controller.ScoreTrackerController;
import app.porrapp.model.UserAccount;
import app.porrapp.service.league.ScoreTrackerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** El alta desde la web solo envía el nombre: los campos opcionales que faltan no invalidan la petición. */
@WebMvcTest(ScoreTrackerController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class ScoreTrackerCreateRequestTest {
    private MockMvc mvc;
    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy securityFilterChain;
    @MockitoBean private ScoreTrackerService service;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private app.porrapp.repository.UserAccountRepository users;

    @BeforeEach
    void configureSecurityChain() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(securityFilterChain).build();
        when(jwtUtil.verify("test-session")).thenReturn(Optional.of(
                new JwtUtil.VerifiedToken("owner@test.invalid", 42L, Instant.now().plusSeconds(60))));
        when(users.findById(42L)).thenReturn(Optional.of(
                UserAccount.builder().id(42L).googleEmail("owner@test.invalid").build()));
    }

    @Test
    void createsAScoreboardFromJustAName() throws Exception {
        mvc.perform(post("/api/trackers").header("Authorization", "Bearer test-session")
                        .contentType("application/json").content("{\"name\":\"Los del viernes\"}"))
                .andExpect(status().isCreated());
        verify(service).create(eq("owner@test.invalid"),
                argThat(r -> r.name().equals("Los del viernes") && !r.lowerWins() && r.mode() == null));
    }

    @Test
    void addsAGameWithoutSayingWhoWins() throws Exception {
        mvc.perform(post("/api/trackers/7/games").header("Authorization", "Bearer test-session")
                        .contentType("application/json").content("{\"name\":\"Mus\"}"))
                .andExpect(status().is2xxSuccessful());
    }
}
