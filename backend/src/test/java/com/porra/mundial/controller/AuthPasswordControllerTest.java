package com.porra.mundial.controller;

import com.porra.mundial.config.CsrfOriginFilter;
import com.porra.mundial.config.JwtAuthFilter;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.config.RateLimitingFilter;
import com.porra.mundial.config.SecurityConfig;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.PasswordAuthService;
import com.porra.mundial.service.account.PasswordResetService;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Registro y login con contraseña sin sesión previa, con la seguridad real (CSRF por origen). */
@WebMvcTest(AuthPasswordController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class AuthPasswordControllerTest {

    private static final String APP_ORIGIN = "http://localhost:5173";
    private static final String BODY = "{\"email\":\"marta@test.com\",\"password\":\"una-clave-larga\"}";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PasswordAuthService passwordAuthService;

    @MockitoBean
    private PasswordResetService passwordResetService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    private static SessionTokens tokens() {
        UserAccount user = UserAccount.builder().id(9L).googleEmail("marta@test.com").participantName("marta").build();
        return new SessionTokens("access-9", "refresh-9", Instant.now().plus(Duration.ofDays(30)), user);
    }

    @Test
    void registeringReturnsTheSessionAndTheRefreshCookie() throws Exception {
        when(passwordAuthService.register("marta@test.com", "una-clave-larga")).thenReturn(tokens());

        mockMvc.perform(post("/api/auth/password/register").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("access-9"))
                .andExpect(jsonPath("$.participantName").value("marta"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh-9")));
    }

    @Test
    void aWrongPasswordIsUnauthorizedWithItsMessage() throws Exception {
        when(passwordAuthService.login("marta@test.com", "una-clave-larga"))
                .thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email o contraseña incorrectos."));

        mockMvc.perform(post("/api/auth/password/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Email o contraseña incorrectos."));
    }

    @Test
    void aMissingPasswordIsRejectedBeforeTheService() throws Exception {
        mockMvc.perform(post("/api/auth/password/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"marta@test.com\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(passwordAuthService);
    }

    @Test
    void anotherSiteCannotLogSomeoneIn() throws Exception {
        mockMvc.perform(post("/api/auth/password/login").header(HttpHeaders.ORIGIN, "https://evil.example")
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        verifyNoInteractions(passwordAuthService);
    }

    @Test
    void askingForTheResetLinkAnswersTheSameWhateverTheEmail() throws Exception {
        mockMvc.perform(post("/api/auth/password/reset-request").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"nadie@test.com\"}"))
                .andExpect(status().isAccepted());
        verify(passwordResetService).requestReset("nadie@test.com");
    }

    @Test
    void theResetLinkSetsTheNewPasswordAndOpensASession() throws Exception {
        when(passwordResetService.reset("token-del-correo", "clave-nueva-larga")).thenReturn(tokens());

        mockMvc.perform(post("/api/auth/password/reset").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"token-del-correo\",\"password\":\"clave-nueva-larga\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-9"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh-9")));
    }
}
