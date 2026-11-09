package app.porrapp.controller;

import app.porrapp.dto.AppleLoginRequest;
import app.porrapp.dto.LoginResponse;
import app.porrapp.service.account.AuthService;
import app.porrapp.service.account.SessionService.SessionTokens;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inicio de sesión con Apple. Como con Google, el access token va en el cuerpo y el refresh token
 * en su cookie ({@link RefreshTokenCookie}).
 */
@RestController
@RequestMapping("/api/auth/apple")
@RequiredArgsConstructor
public class AuthAppleController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> loginWithApple(@Valid @RequestBody AppleLoginRequest request) {
        SessionTokens session = authService.loginWithApple(request.idToken(), request.name());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.of(session.refreshToken(), session.refreshExpiresAt()))
                .body(LoginResponses.of(session));
    }
}
