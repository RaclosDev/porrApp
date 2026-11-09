package app.porrapp.controller;

import app.porrapp.config.CsrfOriginFilter;
import app.porrapp.config.JwtAuthFilter;
import app.porrapp.config.JwtUtil;
import app.porrapp.config.RateLimitingFilter;
import app.porrapp.config.SecurityConfig;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.account.PasskeyService;
import app.porrapp.service.account.PasskeyService.Ceremony;
import app.porrapp.service.account.PasskeyService.PasskeyView;
import app.porrapp.service.account.SessionService.SessionTokens;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.node.JsonNodeFactory;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Rutas de las llaves de acceso con la seguridad real: qué es público, qué pide sesión y qué origen. */
@WebMvcTest(PasskeyController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class PasskeyControllerTest {

    private static final String APP_ORIGIN = "http://localhost:5173";
    private static final String REFRESH_COOKIE = "__Secure-porra_refresh";
    private static final String CREDENTIAL = "{\"requestId\":\"req-1\",\"credential\":{\"id\":\"abc\",\"type\":\"public-key\"}}";

    @Autowired private MockMvc mockMvc;
    @MockitoBean private PasskeyService passkeyService;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private UserAccountRepository userAccountRepository;

    private static final UserAccount ANA = UserAccount.builder().id(7L).googleEmail("ana@test.com").participantName("Ana").build();
    private static final Principal ANA_PRINCIPAL = () -> "ana@test.com";

    @Test
    void loginOptionsArePublicAndCarryTheBrowserOptionsAsJson() throws Exception {
        when(passkeyService.startLogin()).thenReturn(new Ceremony("req-1", "{\"publicKey\":{\"challenge\":\"xyz\"}}"));

        mockMvc.perform(post("/api/auth/passkeys/login/options").header(HttpHeaders.ORIGIN, APP_ORIGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestId").value("req-1"))
                .andExpect(jsonPath("$.options.publicKey.challenge").value("xyz"));
    }

    @Test
    void aValidPasskeyOpensASessionLikeTheGoogleLogin() throws Exception {
        when(passkeyService.finishLogin(eq("req-1"), any())).thenReturn(Optional.of(
                new SessionTokens("access-ana", "refresh-ana", Instant.now().plus(Duration.ofDays(90)), ANA)));

        mockMvc.perform(post("/api/auth/passkeys/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("access-ana"))
                .andExpect(jsonPath("$.participantName").value("Ana"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, allOf(
                        containsString(REFRESH_COOKIE + "=refresh-ana"), containsString("HttpOnly"))));
        // El servicio recibe la credencial tal cual llegó, en JSON.
        verify(passkeyService).finishLogin("req-1", "{\"id\":\"abc\",\"type\":\"public-key\"}");
    }

    @Test
    void aRejectedPasskeyIsA401WithoutCookie() throws Exception {
        when(passkeyService.finishLogin(any(), any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/passkeys/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    void loggingInOnlyAcceptsRequestsFromTheApp() throws Exception {
        mockMvc.perform(post("/api/auth/passkeys/login").header(HttpHeaders.ORIGIN, "https://evil.example")
                        .contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isForbidden());
        verify(passkeyService, never()).finishLogin(any(), any());
    }

    @Test
    void managingPasskeysNeedsASession() throws Exception {
        mockMvc.perform(get("/api/users/me/passkeys")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/users/me/passkeys/options")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/users/me/passkeys/3")).andExpect(status().isUnauthorized());
        verify(passkeyService, never()).startRegistration(any());
    }

    @Test
    void registeringAddsAPasskeyToTheSignedInAccount() {
        when(passkeyService.startRegistration("ana@test.com"))
                .thenReturn(new Ceremony("req-2", "{\"publicKey\":{\"user\":{\"name\":\"ana@test.com\"}}}"));
        when(passkeyService.finishRegistration(eq("ana@test.com"), eq("req-2"), any(), eq("iPhone")))
                .thenReturn(new PasskeyView(3L, "iPhone", Instant.now(), null));
        PasskeyController controller = new PasskeyController(passkeyService);

        assertThat(controller.registrationOptions(ANA_PRINCIPAL))
                .isEqualTo("{\"requestId\":\"req-2\",\"options\":{\"publicKey\":{\"user\":{\"name\":\"ana@test.com\"}}}}");
        ResponseEntity<PasskeyView> created = controller.register(ANA_PRINCIPAL, new PasskeyController.NewPasskey(
                "req-2", JsonNodeFactory.instance.objectNode().put("id", "abc"), "iPhone"));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        assertThat(created.getBody()).extracting(PasskeyView::name).isEqualTo("iPhone");
        verify(passkeyService).finishRegistration("ana@test.com", "req-2", "{\"id\":\"abc\"}", "iPhone");
    }

    @Test
    void listingAndDeletingAreScopedToTheAccount() {
        when(passkeyService.list("ana@test.com")).thenReturn(List.of(new PasskeyView(3L, "iPhone", Instant.now(), null)));
        when(passkeyService.delete("ana@test.com", 3L)).thenReturn(true);
        when(passkeyService.delete("ana@test.com", 4L)).thenReturn(false);
        PasskeyController controller = new PasskeyController(passkeyService);

        assertThat(controller.list(ANA_PRINCIPAL)).extracting(PasskeyView::name).containsExactly("iPhone");
        assertThat(controller.delete(ANA_PRINCIPAL, 3L).getStatusCode().value()).isEqualTo(200);
        assertThat(controller.delete(ANA_PRINCIPAL, 4L).getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void aMissingCredentialIsABadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/passkeys/login").header(HttpHeaders.ORIGIN, APP_ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"requestId\":\"req-1\"}"))
                .andExpect(status().isBadRequest());
        verify(passkeyService, never()).finishLogin(any(), any());
    }
}
