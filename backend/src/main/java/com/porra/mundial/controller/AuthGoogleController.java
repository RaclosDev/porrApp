package com.porra.mundial.controller;

import com.porra.mundial.dto.LoginRequest;
import com.porra.mundial.dto.LoginResponse;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.AuthService;
import com.porra.mundial.service.SessionService.SessionTokens;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inicio de sesión con la credencial de Google Identity Services. Devuelve el access token en
 * el cuerpo y el refresh token en su cookie ({@link RefreshTokenCookie}).
 */
@RestController
@RequestMapping("/api/auth/google")
@RequiredArgsConstructor
public class AuthGoogleController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> loginWithGoogle(@Valid @RequestBody LoginRequest request) {
        SessionTokens session = authService.loginWithGoogle(request.credential());
        UserAccount user = session.user();
        LoginResponse body = new LoginResponse(
                session.accessToken(),
                user.getId(),
                user.getParticipantName(),
                "login_success",
                user.getLastSelectedGroupId() != null ? user.getLastSelectedGroupId() : -1L,
                user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.of(session.refreshToken(), session.refreshExpiresAt()))
                .body(body);
    }
}
