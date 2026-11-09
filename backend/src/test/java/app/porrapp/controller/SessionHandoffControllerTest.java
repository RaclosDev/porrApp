package app.porrapp.controller;

import app.porrapp.config.CsrfOriginFilter;
import app.porrapp.config.JwtAuthFilter;
import app.porrapp.config.JwtUtil;
import app.porrapp.config.RateLimitingFilter;
import app.porrapp.config.SecurityConfig;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.account.SessionHandoffService;
import app.porrapp.service.account.SessionHandoffService.Handoff;
import app.porrapp.service.account.SessionService.SessionTokens;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cookies y protección de las rutas del traspaso de sesión a la app instalada, con la seguridad real. */
@WebMvcTest(SessionHandoffController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class SessionHandoffControllerTest {

    private static final String APP_ORIGIN = "http://localhost:5173";
    private static final String HANDOFF_COOKIE = "__Secure-porra_handoff";
    private static final String REFRESH_COOKIE = "__Secure-porra_refresh";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SessionHandoffService handoffService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @MockitoBean
    private UserAccountRepository userAccountRepository;

    private static final UserAccount ANA = UserAccount.builder().id(7L).googleEmail("ana@test.com").participantName("Ana").build();

    private void signedInAs(UserAccount user, String accessToken) {
        when(jwtUtil.verify(accessToken)).thenReturn(Optional.of(
                new JwtUtil.VerifiedToken(user.getGoogleEmail(), user.getId(), Instant.now().plusSeconds(600))));
        when(userAccountRepository.findById(user.getId())).thenReturn(Optional.of(user));
    }

    @Test
    void preparingPutsTheCodeOnlyInAnHttpOnlyCookieForTheRedeemPath() {
        when(handoffService.prepare("ana@test.com"))
                .thenReturn(Optional.of(new Handoff("code-1", Instant.now().plus(Duration.ofMinutes(30)))));
        Principal ana = () -> "ana@test.com";

        ResponseEntity<?> response = new SessionHandoffController(handoffService).prepare(ana);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
                .contains(HANDOFF_COOKIE + "=code-1", "Path=/api/auth/session/handoff", "HttpOnly", "Secure",
                        "SameSite=Strict")
                .containsPattern("Max-Age=1(799|800)");
        // El código no va en el cuerpo: el JavaScript de la página no llega a verlo.
        assertThat(String.valueOf(response.getBody())).doesNotContain("code-1");
    }

    @Test
    void preparingNeedsASignedInUserFromTheApp() throws Exception {
        mockMvc.perform(post("/api/auth/handoff").header(HttpHeaders.ORIGIN, APP_ORIGIN))
                .andExpect(status().isUnauthorized());

        signedInAs(ANA, "access-ana");
        mockMvc.perform(post("/api/auth/handoff").header(HttpHeaders.ORIGIN, "https://evil.example")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer access-ana"))
                .andExpect(status().isForbidden());
        verify(handoffService, never()).prepare(any());
    }

    @Test
    void redeemingSetsTheNewSessionAndClearsTheCode() throws Exception {
        when(handoffService.redeem("code-1")).thenReturn(Optional.of(
                new SessionTokens("access-app", "refresh-app", Instant.now().plus(Duration.ofDays(90)), ANA)));

        mockMvc.perform(post("/api/auth/session/handoff").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .cookie(new Cookie(HANDOFF_COOKIE, "code-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-app"))
                .andExpect(header().stringValues(HttpHeaders.SET_COOKIE, hasItem(allOf(
                        containsString(REFRESH_COOKIE + "=refresh-app"), containsString("Path=/api/auth/session;")))))
                .andExpect(header().stringValues(HttpHeaders.SET_COOKIE, hasItem(allOf(
                        containsString(HANDOFF_COOKIE + "=;"), containsString("Max-Age=0")))))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
    }

    @Test
    void aSpentOrMissingCodeIsA401ThatLeavesTheRefreshCookieAlone() throws Exception {
        when(handoffService.redeem(any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/session/handoff").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .cookie(new Cookie(HANDOFF_COOKIE, "spent")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().stringValues(HttpHeaders.SET_COOKIE, hasItem(containsString(HANDOFF_COOKIE + "=;"))))
                .andExpect(header().stringValues(HttpHeaders.SET_COOKIE, not(hasItem(containsString(REFRESH_COOKIE)))));
    }

    @Test
    void redeemingOnlyAcceptsRequestsFromTheApp() throws Exception {
        Cookie cookie = new Cookie(HANDOFF_COOKIE, "code-1");

        mockMvc.perform(post("/api/auth/session/handoff").header(HttpHeaders.ORIGIN, "https://evil.example").cookie(cookie))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/session/handoff").cookie(cookie))
                .andExpect(status().isForbidden());
        verify(handoffService, never()).redeem(any());
    }
}
