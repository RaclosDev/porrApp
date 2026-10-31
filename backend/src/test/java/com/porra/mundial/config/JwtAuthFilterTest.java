package com.porra.mundial.config;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class JwtAuthFilterTest {
    private static final String SECRET = "filter-test-secret-with-more-than-32-bytes";
    private final JwtUtil jwtUtil = new JwtUtil(SECRET, new org.springframework.mock.env.MockEnvironment());
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, users);

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(String token) throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {});
    }

    @Test
    void anEmailChangeDoesNotTransferAnAccessTokenToTheNewOwnerOfTheOldEmail() throws Exception {
        when(users.findById(42L)).thenReturn(Optional.of(UserAccount.builder()
                .id(42L).googleSub("google-original").googleEmail("current@test.com").build()));
        authenticate(jwtUtil.generateAccessToken(42L, "reassigned@test.com"));

        assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("current@test.com");
        verify(users, never()).findByGoogleEmail(anyString());
    }

    @Test
    void anAccessTokenForADeletedAccountDoesNotAuthenticateAnotherAccountWithItsEmail() throws Exception {
        authenticate(jwtUtil.generateAccessToken(42L, "reassigned@test.com"));

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void legacyTokensCannotAuthenticateAnAccountAlreadyLinkedToAGoogleSubject() throws Exception {
        when(users.findByGoogleEmail("reassigned@test.com")).thenReturn(Optional.of(UserAccount.builder()
                .id(99L).googleSub("google-new-owner").googleEmail("reassigned@test.com").build()));
        authenticate(JwtUtilTest.legacyToken(SECRET, "reassigned@test.com", "reassigned@test.com",
                Instant.now().plusSeconds(60)));

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void legacyTokensStillAuthenticateExistingAccountsThatHaveNotMigrated() throws Exception {
        when(users.findByGoogleEmail("legacy@test.com")).thenReturn(Optional.of(UserAccount.builder()
                .id(7L).googleEmail("legacy@test.com").build()));
        authenticate(JwtUtilTest.legacyToken(SECRET, "legacy@test.com", "legacy@test.com",
                Instant.now().plusSeconds(60)));

        assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("legacy@test.com");
    }
}
