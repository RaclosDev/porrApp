package com.porra.mundial.controller;

import com.porra.mundial.config.CsrfOriginFilter;
import com.porra.mundial.config.JwtAuthFilter;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.config.RateLimitingFilter;
import com.porra.mundial.config.SecurityConfig;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.AuthService;
import com.porra.mundial.service.SessionService;
import com.porra.mundial.service.SessionService.SessionTokens;
import jakarta.servlet.http.Cookie;
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
import java.util.Optional;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cookie del refresh token y protección CSRF de las rutas de sesión, con la seguridad real. */
@WebMvcTest({AuthSessionController.class, AuthGoogleController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class AuthSessionControllerTest {

    private static final String APP_ORIGIN = "http://localhost:5173";
    private static final String COOKIE = "__Secure-porra_refresh";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SessionService sessionService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private com.porra.mundial.repository.UserAccountRepository userAccountRepository;

    private static SessionTokens tokens(String accessToken, String refreshToken) {
        UserAccount user = UserAccount.builder().id(7L).googleEmail("ana@test.com").participantName("Ana").build();
        return new SessionTokens(accessToken, refreshToken, Instant.now().plus(Duration.ofDays(30)), user);
    }

    @Test
    void loginReturnsTheAccessTokenAndSetsTheRefreshCookie() throws Exception {
        when(authService.loginWithGoogle("google-credential")).thenReturn(tokens("access-1", "refresh-1"));

        mockMvc.perform(post("/api/auth/google/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"credential\":\"google-credential\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-1"))
                .andExpect(jsonPath("$.userId").value(7))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, allOf(
                        containsString(COOKIE + "=refresh-1"),
                        containsString("Path=/api/auth/session"),
                        matchesPattern(".*Max-Age=259(19|20)\\d\\d.*"),
                        containsString("HttpOnly"),
                        containsString("Secure"),
                        containsString("SameSite=Strict"))))
                // El refresh token solo va en la cookie.
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
    }

    @Test
    void refreshRotatesTheCookie() throws Exception {
        when(sessionService.refresh("refresh-1")).thenReturn(Optional.of(tokens("access-2", "refresh-2")));

        mockMvc.perform(post("/api/auth/session/refresh").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .cookie(new Cookie(COOKIE, "refresh-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-2"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString(COOKIE + "=refresh-2")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
    }

    @Test
    void aRejectedRefreshClearsTheCookie() throws Exception {
        when(sessionService.refresh(any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/session/refresh").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .cookie(new Cookie(COOKIE, "rotated")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, allOf(
                        containsString(COOKIE + "=;"), containsString("Max-Age=0"))));
    }

    @Test
    void logoutRevokesTheSessionAndClearsTheCookie() throws Exception {
        mockMvc.perform(post("/api/auth/session/logout").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .cookie(new Cookie(COOKIE, "refresh-1")))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

        verify(sessionService).end("refresh-1");
    }

    @Test
    void exchangeTakesTheLegacyTokenFromTheAuthorizationHeader() throws Exception {
        when(sessionService.exchangeLegacyToken("legacy-jwt")).thenReturn(Optional.of(tokens("access-3", "refresh-3")));

        mockMvc.perform(post("/api/auth/session/exchange").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer legacy-jwt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-3"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString(COOKIE + "=refresh-3")));
    }

    @Test
    void aFailedExchangeKeepsTheCookieTheBrowserMayAlreadyHave() throws Exception {
        when(sessionService.exchangeLegacyToken(any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/session/exchange").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-legacy"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
        mockMvc.perform(post("/api/auth/session/exchange").header(HttpHeaders.ORIGIN, APP_ORIGIN))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sessionRoutesOnlyAcceptRequestsFromTheApp() throws Exception {
        Cookie cookie = new Cookie(COOKIE, "refresh-1");

        mockMvc.perform(post("/api/auth/session/refresh").header(HttpHeaders.ORIGIN, "https://evil.example").cookie(cookie))
                .andExpect(status().isForbidden());
        // Sin Origin ni Sec-Fetch-Site no hay forma de saber de dónde viene.
        mockMvc.perform(post("/api/auth/session/refresh").cookie(cookie))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/session/logout").cookie(cookie))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/google/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"x\"}"))
                .andExpect(status().isForbidden());
        verify(sessionService, never()).refresh(any());
        verify(sessionService, never()).end(any());

        when(sessionService.refresh("refresh-1")).thenReturn(Optional.of(tokens("a", "r")));
        // Mismo origen que la API (MockMvc sirve en http://localhost) o Sec-Fetch-Site del navegador.
        mockMvc.perform(post("/api/auth/session/refresh").header(HttpHeaders.ORIGIN, "http://localhost").cookie(cookie))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/session/refresh").header("Sec-Fetch-Site", "same-origin").cookie(cookie))
                .andExpect(status().isOk());
    }
}
