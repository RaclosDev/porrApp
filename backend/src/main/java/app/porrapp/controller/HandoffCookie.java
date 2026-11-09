package app.porrapp.controller;

import org.springframework.http.ResponseCookie;

import java.time.Duration;
import java.time.Instant;

/**
 * Cookie del código de traspaso de sesión a la app instalada en iPhone. Mismas protecciones que
 * {@link RefreshTokenCookie}, y solo se manda a la ruta del canje.
 */
final class HandoffCookie {

    static final String NAME = "__Secure-porra_handoff";
    static final String PATH = RefreshTokenCookie.PATH + "/handoff";

    private HandoffCookie() {
    }

    static String of(String code, Instant expiresAt) {
        Duration maxAge = Duration.between(Instant.now(), expiresAt);
        return base(code).maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge).build().toString();
    }

    static String cleared() {
        return base("").maxAge(Duration.ZERO).build().toString();
    }

    private static ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path(PATH);
    }
}
