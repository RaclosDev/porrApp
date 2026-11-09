package app.porrapp.controller;

import app.porrapp.dto.AccessTokenResponse;
import app.porrapp.dto.ErrorResponse;
import app.porrapp.service.account.SessionHandoffService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * Traspaso de la sesión de Safari a la app instalada en iPhone ({@link SessionHandoffService}).
 * El código nunca llega al JavaScript: va y vuelve en la cookie {@link HandoffCookie}.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class SessionHandoffController {

    private final SessionHandoffService handoffService;

    /** Con sesión iniciada: deja en una cookie el código que canjeará la app instalada. */
    @PostMapping("/handoff")
    public ResponseEntity<?> prepare(Principal principal) {
        return handoffService.prepare(CurrentUser.email(principal))
                .<ResponseEntity<?>>map(handoff -> ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, HandoffCookie.of(handoff.code(), handoff.expiresAt()))
                        .body(Map.of("expiresInSeconds",
                                Duration.between(Instant.now(), handoff.expiresAt()).toSeconds())))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    /**
     * Primera apertura de la app instalada: canjea el código de la cookie por una sesión nueva.
     * Con o sin éxito, la cookie del código se borra.
     */
    @PostMapping("/session/handoff")
    public ResponseEntity<?> redeem(@CookieValue(name = HandoffCookie.NAME, required = false) String code) {
        return handoffService.redeem(code)
                .<ResponseEntity<?>>map(tokens -> ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE,
                                RefreshTokenCookie.of(tokens.refreshToken(), tokens.refreshExpiresAt()),
                                HandoffCookie.cleared())
                        .body(new AccessTokenResponse(tokens.accessToken())))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .header(HttpHeaders.SET_COOKIE, HandoffCookie.cleared())
                        .body(new ErrorResponse("No hay ninguna sesión que traspasar.")));
    }
}
