package com.porra.mundial.controller;

import com.porra.mundial.dto.LoginResponse;
import com.porra.mundial.dto.PasswordCredentials;
import com.porra.mundial.service.account.PasswordAuthService;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Registro e inicio de sesión con email y contraseña. Como con Google, el access token va en el
 * cuerpo y el refresh token en su cookie ({@link RefreshTokenCookie}).
 */
@RestController
@RequestMapping("/api/auth/password")
@RequiredArgsConstructor
public class AuthPasswordController {

    private final PasswordAuthService passwordAuthService;

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@Valid @RequestBody PasswordCredentials request) {
        return withSession(HttpStatus.CREATED, passwordAuthService.register(request.email(), request.password()));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody PasswordCredentials request) {
        return withSession(HttpStatus.OK, passwordAuthService.login(request.email(), request.password()));
    }

    private static ResponseEntity<LoginResponse> withSession(HttpStatus status, SessionTokens session) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.of(session.refreshToken(), session.refreshExpiresAt()))
                .body(LoginResponses.of(session));
    }
}
