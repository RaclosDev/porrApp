package com.porra.mundial.controller;

import org.springframework.http.ResponseCookie;

import java.time.Duration;
import java.time.Instant;

/**
 * Cookie del refresh token.
 * <ul>
 *   <li>HttpOnly: el JavaScript de la página no puede leerla, ni un XSS tampoco.</li>
 *   <li>Secure y prefijo {@code __Secure-}: solo viaja por HTTPS (o a localhost) y nadie puede
 *       sobrescribirla desde HTTP.</li>
 *   <li>SameSite=Strict: no sale en peticiones iniciadas desde otro sitio. La SPA y la API
 *       comparten origen, así que no hace falta Lax.</li>
 *   <li>Path={@value #PATH}: el navegador solo la manda al refresco y al logout, no a cada
 *       petición de la API.</li>
 * </ul>
 */
final class RefreshTokenCookie {

    static final String NAME = "__Secure-porra_refresh";
    static final String PATH = "/api/auth/session";

    private RefreshTokenCookie() {
    }

    /** Cookie con el refresh token, que vive hasta que caduca la sesión. */
    static String of(String refreshToken, Instant expiresAt) {
        Duration maxAge = Duration.between(Instant.now(), expiresAt);
        return base(refreshToken).maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge).build().toString();
    }

    /** Borra la cookie del navegador. */
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
