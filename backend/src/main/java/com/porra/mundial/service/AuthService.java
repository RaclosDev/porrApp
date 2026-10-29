package com.porra.mundial.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.dto.LoginResponse;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * Inicio de sesión con Google: verifica el ID token, crea la cuenta la primera vez
 * (con un apodo único a partir del nombre de Google) y emite el JWT de la aplicación.
 */
@Service
@Slf4j
public class AuthService {

    private final UserAccountRepository userAccountRepository;
    private final JwtUtil jwtUtil;
    private final GoogleIdTokenVerifier verifier;

    public AuthService(UserAccountRepository userAccountRepository, JwtUtil jwtUtil,
                       @Value("${google.client.id}") String googleClientId) {
        this.userAccountRepository = userAccountRepository;
        this.jwtUtil = jwtUtil;
        this.verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(List.of(googleClientId))
                .build();
    }

    @Transactional
    public LoginResponse loginWithGoogle(String credential) {
        GoogleIdToken.Payload google = verify(credential);
        if (!Boolean.TRUE.equals(google.getEmailVerified())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La dirección de correo de Google no está verificada.");
        }
        String email = google.getEmail();
        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseGet(() -> register(email, (String) google.get("name")));

        return new LoginResponse(
                jwtUtil.generateToken(email, email),
                user.getId(),
                user.getParticipantName(),
                "login_success",
                user.getLastSelectedGroupId() != null ? user.getLastSelectedGroupId() : -1L,
                user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
    }

    private GoogleIdToken.Payload verify(String credential) {
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
        return idToken.getPayload();
    }

    /** Alta automática con los datos de Google; el apodo se desambigua con un sufijo numérico. */
    private UserAccount register(String email, String googleName) {
        String baseName = googleName != null && !googleName.isBlank() ? googleName.trim() : email.split("@")[0];
        String participantName = baseName;
        for (int suffix = 1; userAccountRepository.existsByParticipantNameIgnoreCase(participantName); suffix++) {
            participantName = baseName + suffix;
        }
        return userAccountRepository.save(UserAccount.builder()
                .googleEmail(email)
                .googleName(googleName != null ? googleName : participantName)
                .participantName(participantName)
                .build());
    }
}
