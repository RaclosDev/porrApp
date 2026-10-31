package com.porra.mundial.controller;

import com.porra.mundial.config.JwtAuthFilter;
import com.porra.mundial.dto.AccessTokenResponse;
import com.porra.mundial.dto.ErrorResponse;
import com.porra.mundial.service.SessionService;
import com.porra.mundial.service.SessionService.SessionTokens;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * Sesión con refresh token. Todas las rutas cuelgan de {@link RefreshTokenCookie#PATH}, que es
 * el único sitio al que el navegador manda la cookie. Al usar una cookie son vulnerables a
 * CSRF: las protegen SameSite=Strict y la comprobación de origen de {@code CsrfOriginFilter}.
 */
@RestController
@RequestMapping(RefreshTokenCookie.PATH)
@RequiredArgsConstructor
public class AuthSessionController {

    private final SessionService sessionService;

    /** Rota el refresh token de la cookie y devuelve un access token nuevo. */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
        return sessionService.refresh(refreshToken)
                .<ResponseEntity<?>>map(AuthSessionController::withSession)
                .orElseGet(() -> unauthorized().header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.cleared())
                        .body(new ErrorResponse("La sesión ha caducado. Vuelve a iniciar sesión.")));
    }

    /** Revoca la sesión de la cookie y la borra. Responde 204 aunque no hubiera sesión. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
        sessionService.end(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.cleared())
                .build();
    }

    /**
     * Transición: cambia el JWT de 7 días que la versión anterior guardaba en localStorage
     * (cabecera {@code Authorization: Bearer}) por una sesión con refresh token. Si no se
     * puede, no toca la cookie: el navegador puede tener ya una sesión válida.
     */
    @PostMapping("/exchange")
    public ResponseEntity<?> exchangeLegacyToken(HttpServletRequest request) {
        String legacyToken = JwtAuthFilter.bearerToken(request);
        Optional<SessionTokens> session = legacyToken != null
                ? sessionService.exchangeLegacyToken(legacyToken)
                : Optional.empty();
        return session
                .<ResponseEntity<?>>map(AuthSessionController::withSession)
                .orElseGet(() -> unauthorized().body(new ErrorResponse("El token no se puede canjear.")));
    }

    private static ResponseEntity<AccessTokenResponse> withSession(SessionTokens tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.of(tokens.refreshToken(), tokens.refreshExpiresAt()))
                .body(new AccessTokenResponse(tokens.accessToken()));
    }

    private static ResponseEntity.BodyBuilder unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED);
    }
}
