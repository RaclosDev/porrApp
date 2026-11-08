package com.porra.mundial.controller;

import com.porra.mundial.config.CsrfOriginFilter;
import com.porra.mundial.config.JwtAuthFilter;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.config.RateLimitingFilter;
import com.porra.mundial.config.SecurityConfig;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.AuthService;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Inicio de sesión con Apple sin sesión previa, con la seguridad real (CSRF por origen). */
@WebMvcTest(AuthAppleController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class AuthAppleControllerTest {

    private static final String APP_ORIGIN = "http://localhost:5173";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    @Test
    void loginReturnsTheSessionAndTheRefreshCookie() throws Exception {
        UserAccount user = UserAccount.builder().id(5L).googleEmail("nuria@icloud.com").participantName("Nuria").build();
        when(authService.loginWithApple("apple-token", "Nuria"))
                .thenReturn(new SessionTokens("access-5", "refresh-5", Instant.now().plus(Duration.ofDays(30)), user));

        mockMvc.perform(post("/api/auth/apple/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"idToken\":\"apple-token\",\"name\":\"Nuria\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-5"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh-5")));
    }

    @Test
    void aMissingTokenIsRejectedBeforeTheService() throws Exception {
        mockMvc.perform(post("/api/auth/apple/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(authService);
    }
}
