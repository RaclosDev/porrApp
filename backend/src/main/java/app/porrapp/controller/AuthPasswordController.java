package app.porrapp.controller;

import app.porrapp.dto.LoginResponse;
import app.porrapp.dto.PasswordCredentials;
import app.porrapp.dto.PasswordReset;
import app.porrapp.dto.PasswordResetRequest;
import app.porrapp.dto.RegistrationConfirmation;
import app.porrapp.service.account.PasswordAuthService;
import app.porrapp.service.account.PasswordResetService;
import app.porrapp.service.account.SessionService.SessionTokens;
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

    /**
     * Empieza el registro. Con correo configurado responde 202 y manda un código al email (o el aviso
     * de que ya tiene cuenta: la respuesta es la misma); sin correo, crea la cuenta y abre sesión.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody PasswordCredentials request) {
        return passwordAuthService.register(request.email(), request.password())
                .<ResponseEntity<?>>map(session -> withSession(HttpStatus.CREATED, session))
                .orElseGet(() -> ResponseEntity.accepted().body(Map.of("verificationRequired", true)));
    }

    /** Termina el registro con el código del correo y la misma contraseña, y abre sesión. */
    @PostMapping("/register/confirm")
    public ResponseEntity<LoginResponse> confirmRegistration(@Valid @RequestBody RegistrationConfirmation request) {
        return withSession(HttpStatus.CREATED,
                passwordAuthService.confirmRegistration(request.email(), request.code(), request.password()));
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
                "Si hay una cuenta con ese email, te llegará un correo."));
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
