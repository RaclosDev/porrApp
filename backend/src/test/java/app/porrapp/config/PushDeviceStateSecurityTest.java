package app.porrapp.config;

import app.porrapp.controller.PushDeviceStateController;
import app.porrapp.service.notification.PushDeviceStateService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import java.time.Instant;
import java.util.Optional;
import app.porrapp.model.UserAccount;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.security.web.FilterChainProxy;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PushDeviceStateController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class PushDeviceStateSecurityTest {
    private MockMvc mvc;
    @Autowired private WebApplicationContext context;
    @Autowired private FilterChainProxy securityFilterChain;
    @MockitoBean private PushDeviceStateService states;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private app.porrapp.repository.UserAccountRepository users;
    private static final String BODY = """
            {"deviceId":"12345678-1234-4123-8123-123456789abc","permission":"denied","installRequired":false,"promptShown":true}
            """;

    @BeforeEach
    void configureSecurityChain() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(securityFilterChain).build();
    }

    @Test
    void requiresASessionAndDoesNotExposeAnInventory() throws Exception {
        mvc.perform(post("/api/push/device-state").contentType("application/json").content(BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/push/device-state")).andExpect(status().isUnauthorized());
        verifyNoInteractions(states);
    }

    private void authenticate() {
        when(jwtUtil.verify("test-session")).thenReturn(Optional.of(new JwtUtil.VerifiedToken("owner@test.invalid", 42L, Instant.now().plusSeconds(60))));
        when(users.findById(42L)).thenReturn(Optional.of(UserAccount.builder().id(42L).googleEmail("owner@test.invalid").build()));
    }

    @Test
    void recordsOnlyForTheAuthenticatedAccount() throws Exception {
        authenticate();
        mvc.perform(post("/api/push/device-state").header("Authorization", "Bearer test-session").contentType("application/json").content(BODY))
                .andExpect(status().isNoContent());
        verify(states).observe(eq("owner@test.invalid"), argThat(r -> r.permission().equals("denied") && r.promptShown()));
    }

    @Test
    void rejectsMalformedAndMissingValues() throws Exception {
        authenticate();
        for (String body : new String[]{"{}", BODY.replace("denied", "unknown"), BODY.replace("12345678-1234-4123-8123-123456789abc", "bad")}) {
            mvc.perform(post("/api/push/device-state").header("Authorization", "Bearer test-session").contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(states);
    }
}
