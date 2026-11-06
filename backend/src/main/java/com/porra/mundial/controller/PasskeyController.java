package com.porra.mundial.controller;

import com.porra.mundial.dto.ErrorResponse;
import com.porra.mundial.service.account.PasskeyService;
import com.porra.mundial.service.account.PasskeyService.Ceremony;
import com.porra.mundial.service.account.PasskeyService.PasskeyView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

import java.security.Principal;
import java.util.List;

/**
 * Llaves de acceso ({@link PasskeyService}). Entrar con una llave es público y devuelve lo mismo que
 * el login con Google; añadirlas, verlas y borrarlas requiere la sesión de su cuenta.
 */
@RestController
@RequiredArgsConstructor
public class PasskeyController {

    private final PasskeyService passkeyService;

    @PostMapping(value = "/api/auth/passkeys/login/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public String loginOptions() {
        return ceremonyJson(passkeyService.startLogin());
    }

    @PostMapping("/api/auth/passkeys/login")
    public ResponseEntity<?> login(@Valid @RequestBody PasskeyResponse body) {
        return passkeyService.finishLogin(body.requestId(), body.credential().toString())
                .<ResponseEntity<?>>map(session -> ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.of(session.refreshToken(), session.refreshExpiresAt()))
                        .body(LoginResponses.of(session)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("No se ha podido entrar con esta llave de acceso.")));
    }

    @GetMapping("/api/users/me/passkeys")
    public List<PasskeyView> list(Principal principal) {
        return passkeyService.list(CurrentUser.email(principal));
    }

    @PostMapping(value = "/api/users/me/passkeys/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public String registrationOptions(Principal principal) {
        return ceremonyJson(passkeyService.startRegistration(CurrentUser.email(principal)));
    }

    @PostMapping("/api/users/me/passkeys")
    public ResponseEntity<PasskeyView> register(Principal principal, @Valid @RequestBody NewPasskey body) {
        PasskeyView saved = passkeyService.finishRegistration(
                CurrentUser.email(principal), body.requestId(), body.credential().toString(), body.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /** Borra la llave y devuelve las que quedan; 404 si no es de la cuenta. */
    @DeleteMapping("/api/users/me/passkeys/{id}")
    public ResponseEntity<List<PasskeyView>> delete(Principal principal, @PathVariable Long id) {
        String email = CurrentUser.email(principal);
        return passkeyService.delete(email, id)
                ? ResponseEntity.ok(passkeyService.list(email))
                : ResponseEntity.notFound().build();
    }

    /** {@code {"requestId": "...", "options": {"publicKey": {...}}}}: las opciones ya vienen en JSON. */
    private static String ceremonyJson(Ceremony ceremony) {
        return "{\"requestId\":\"" + ceremony.requestId() + "\",\"options\":" + ceremony.browserOptionsJson() + "}";
    }

    /** Respuesta del navegador a un reto: la credencial en el formato JSON de WebAuthn. */
    public record PasskeyResponse(@NotBlank @Size(max = 64) String requestId, @NotNull JsonNode credential) {
    }

    public record NewPasskey(@NotBlank @Size(max = 64) String requestId, @NotNull JsonNode credential,
                             @Size(max = 200) String name) {
    }
}
