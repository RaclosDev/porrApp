package com.porra.mundial.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

/** Verifica el ID token de Google Identity Services (firma, emisor, audiencia y caducidad). */
@Component
@Slf4j
public class GoogleCredentialVerifier {

    private final GoogleIdTokenVerifier verifier;

    public GoogleCredentialVerifier(@Value("${google.client.id}") String googleClientId) {
        this.verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(List.of(googleClientId))
                .build();
    }

    /** Datos de la cuenta de Google, o 401 si el token no es válido. */
    public GoogleIdentity verify(String credential) {
        GoogleIdToken idToken;
        try {
            idToken = verifier.verify(credential);
        } catch (GeneralSecurityException | IOException | IllegalArgumentException e) {
            log.warn("No se pudo verificar el token de Google: {}", e.getMessage());
            idToken = null;
        }
        if (idToken == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de Google inválido");
        }
        GoogleIdToken.Payload payload = idToken.getPayload();
        return new GoogleIdentity(payload.getSubject(), payload.getEmail(),
                Boolean.TRUE.equals(payload.getEmailVerified()), (String) payload.get("name"));
    }

    /**
     * @param subject       claim "sub": identificador estable de la cuenta
     * @param email         email actual de la cuenta
     * @param emailVerified si Google ha verificado ese email
     * @param name          nombre de la cuenta, o null
     */
    public record GoogleIdentity(String subject, String email, boolean emailVerified, String name) {
    }
}
