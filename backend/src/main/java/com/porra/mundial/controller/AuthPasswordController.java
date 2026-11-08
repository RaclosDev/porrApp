package com.porra.mundial.controller;

import com.porra.mundial.dto.LoginResponse;
import com.porra.mundial.dto.PasswordCredentials;
import com.porra.mundial.dto.PasswordReset;
import com.porra.mundial.dto.PasswordResetRequest;
import com.porra.mundial.service.account.PasswordAuthService;
import com.porra.mundial.service.account.PasswordResetService;
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

import java.util.Map;

/**
 * Registro e inicio de sesión con email y contraseña, y cambiarla con un enlace por correo. Como con Google, el access token va en el
 * cuerpo y el refresh token en su cookie ({@link RefreshTokenCookie}).
 */
@RestController
@RequestMapping("/api/auth/password")
@RequiredArgsConstructor
public class AuthPasswordController {

    private final PasswordAuthService passwordAuthService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@Valid @RequestBody PasswordCredentials request) {
        return withSession(HttpStatus.CREATED, passwordAuthService.register(request.email(), request.password()));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody PasswordCredentials request) {
        return withSession(HttpStatus.OK, passwordAuthService.login(request.email(), request.password()));
    }

    /** Manda el enlace si hay una cuenta con contraseña; responde igual si no, para no revelar emails. */
    @PostMapping("/reset-request")
    public ResponseEntity<Map<String, String>> requestReset(@Valid @RequestBody PasswordResetRequest request) {
        passwordResetService.requestReset(request.email());
        return ResponseEntity.accepted().body(Map.of("message",
                "Si hay una cuenta con contraseña con ese email, te llegará un enlace para cambiarla."));
    }

    /** Pone la contraseña nueva con el token del enlace y abre sesión. */
    @PostMapping("/reset")
    public ResponseEntity<LoginResponse> reset(@Valid @RequestBody PasswordReset request) {
        return withSession(HttpStatus.OK, passwordResetService.reset(request.token(), request.password()));
    }

    private static ResponseEntity<LoginResponse> withSession(HttpStatus status, SessionTokens session) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.of(session.refreshToken(), session.refreshExpiresAt()))
                .body(LoginResponses.of(session));
    }
}
