package com.porra.mundial.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.config.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth/google")
@RequiredArgsConstructor
@Slf4j
public class AuthGoogleController {

    private final UserAccountRepository userAccountRepository;
    private final JwtUtil jwtUtil;

    @Value("${google.client.id:498045926443-u02u6penjkggongduv26qlm7934449ee.apps.googleusercontent.com}")
    private String googleClientId;

    @PostMapping("/login")
    public ResponseEntity<?> loginWithGoogle(@RequestBody Map<String, String> payload) {
        if (googleClientId == null || googleClientId.isBlank()) {
            log.error("GOOGLE_CLIENT_ID no configurado en el servidor");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Servicio de autenticación no configurado (GOOGLE_CLIENT_ID ausente)"));
        }

        String idTokenString = payload.get("credential");

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Token de Google inválido"));
            }

            GoogleIdToken.Payload googlePayload = idToken.getPayload();
            if (!Boolean.TRUE.equals(googlePayload.getEmailVerified())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "La dirección de correo de Google no está verificada."));
            }
            String email = googlePayload.getEmail();
            String name = (String) googlePayload.get("name");

            Optional<UserAccount> existingAccount = userAccountRepository.findByGoogleEmail(email);

            if (existingAccount.isPresent()) {
                UserAccount acc = existingAccount.get();
                String appToken = jwtUtil.generateToken(acc.getGoogleEmail(), acc.getGoogleEmail());
                return ResponseEntity.ok(Map.of(
                        "token", appToken,
                        "userId", acc.getId(),
                        "participantName", acc.getParticipantName(),
                        "status", "login_success",
                        "lastSelectedGroupId", acc.getLastSelectedGroupId() != null ? acc.getLastSelectedGroupId() : -1
                ));
            } else {
                // Registro automático y directo con datos de Google
                String initialName = (name != null && !name.trim().isEmpty())
                        ? name.trim()
                        : email.split("@")[0];

                String candidateName = initialName;
                int suffix = 1;
                while (userAccountRepository.existsByParticipantNameIgnoreCase(candidateName)) {
                    candidateName = initialName + suffix;
                    suffix++;
                }

                UserAccount finalAccount = UserAccount.builder()
                        .googleEmail(email)
                        .googleName(name != null ? name : candidateName)
                        .participantName(candidateName)
                        .build();
                userAccountRepository.save(finalAccount);

                String appToken = jwtUtil.generateToken(email, email);
                return ResponseEntity.ok(Map.of(
                        "token", appToken,
                        "userId", finalAccount.getId(),
                        "participantName", finalAccount.getParticipantName(),
                        "status", "login_success",
                        "lastSelectedGroupId", -1
                ));
            }

        } catch (Exception e) {
            log.error("Error al procesar login con Google", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Error al procesar login con Google"));
        }
    }

    @GetMapping("/claimed-names")
    public ResponseEntity<java.util.List<String>> getClaimedNames() {
        return ResponseEntity.ok(Collections.emptyList());
    }
}
