package app.porrapp.config;

import app.porrapp.controller.PushReceiptController;
import app.porrapp.service.notification.PushRetryQueue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PushReceiptController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, RateLimitingFilter.class, CsrfOriginFilter.class})
class PushReceiptSecurityTest {
    @Autowired private MockMvc mvc;
    @MockitoBean private PushRetryQueue queue;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private app.porrapp.repository.UserAccountRepository users;

    @Test
    void closedAppCanConfirmWithOnlyThePerDeliveryToken() throws Exception {
        UUID token = UUID.randomUUID();
        mvc.perform(post("/api/push/receipts").contentType("application/json")
                .content("{\"token\":\"" + token + "\"}")).andExpect(status().isNoContent());
        verify(queue).acknowledge(token);
    }

    @Test
    void malformedTokensAreRejectedAndOtherPushRoutesRemainPrivate() throws Exception {
        mvc.perform(post("/api/push/receipts").contentType("application/json")
                .content("{\"token\":\"not-a-token\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/push/receipts")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/push/test").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(queue);
    }
}
