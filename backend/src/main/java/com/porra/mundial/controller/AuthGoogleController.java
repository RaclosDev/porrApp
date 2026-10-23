package com.porra.mundial.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.porra.mundial.config.JwtUtil;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
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

    @Value("${app.admins:Admin}")
    private java.util.List<String> appAdmins;

    @Value("${app.admin-emails:raclosnegocios@gmail.com}")
    private java.util.List<String> adminEmails;

    @PostMapping("/login")
    public ResponseEntity<?> loginWithGoogle(@RequestBody Map<String, String> payload) {
        String idTokenString = payload.get("credential");
        String requestedParticipantName = payload.get("participantName");

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Token de Google inválido"));
            }

            GoogleIdToken.Payload googlePayload = idToken.getPayload();
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
                if (requestedParticipantName == null || requestedParticipantName.trim().isEmpty()) {
                    return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                            "status", "requires_name",
                            "googleEmail", email,
                            "googleName", name
                    ));
                }

                String cleanName = requestedParticipantName.trim();
                
                boolean isReservedName = appAdmins.stream().anyMatch(a -> a.equalsIgnoreCase(cleanName));
                if (isReservedName) {
                    boolean isAllowedEmail = adminEmails.stream().anyMatch(ae -> ae.equalsIgnoreCase(email));
                    if (!isAllowedEmail) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                                "error", "Ese nombre está reservado por el sistema para el administrador."
                        ));
                    }
                }

                // Vincula cuentas preexistentes creadas de forma legacy sin email
                java.util.Optional<UserAccount> legacyAccount = userAccountRepository.findByGoogleEmail(cleanName + "@auto.generated");
                UserAccount finalAccount;
                if (legacyAccount.isPresent()) {
                    finalAccount = legacyAccount.get();
                    finalAccount.setGoogleEmail(email);
                    finalAccount.setGoogleName(name);
                    userAccountRepository.save(finalAccount);
                } else {
                    finalAccount = UserAccount.builder()
                            .googleEmail(email)
                            .googleName(name)
                            .participantName(cleanName)
                            .build();
                    userAccountRepository.save(finalAccount);
                }

                String appToken = jwtUtil.generateToken(email, email);
                Map<String, Object> responseMap = new java.util.HashMap<>();
                responseMap.put("token", appToken);
                responseMap.put("userId", finalAccount.getId());
                responseMap.put("participantName", cleanName);
                responseMap.put("status", "registered_success");
                return ResponseEntity.ok(responseMap);
            }

        } catch (Exception e) {
            log.error("Error al procesar login con Google", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Error al procesar login con Google"));
        }
    }

    @GetMapping("/claimed-names")
    public ResponseEntity<java.util.List<String>> getClaimedNames() {
        return ResponseEntity.ok(userAccountRepository.findAllClaimedNames());
    }
}
