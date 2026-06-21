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

    /**
     * Endpoint para iniciar sesión con Google.
     * Recibe el token de Google y el nombre de participante deseado (solo necesario la primera vez).
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginWithGoogle(@RequestBody Map<String, String> payload) {
        String idTokenString = payload.get("credential");
        String requestedParticipantName = payload.get("participantName");

        try {
            // 1. Verificar el token con la clave pública de Google
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

            // 2. Buscar si el usuario ya está registrado en nuestra base de datos
            Optional<UserAccount> existingAccount = userAccountRepository.findByGoogleEmail(email);

            if (existingAccount.isPresent()) {
                // Usuario existente: Emitir nuestro JWT con su nombre asociado y el email de Google
                String participantName = existingAccount.get().getParticipantName();
                String appToken = jwtUtil.generateToken(participantName, existingAccount.get().getGoogleEmail());
                return ResponseEntity.ok(Map.of(
                        "token", appToken,
                        "participantName", participantName,
                        "status", "login_success"
                ));
            } else {
                // Usuario NUEVO: Necesitamos que nos diga qué nombre de participante quiere usar
                if (requestedParticipantName == null || requestedParticipantName.trim().isEmpty()) {
                    // Si no nos ha dicho nombre, le decimos al frontend que se lo pregunte
                    return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                            "status", "requires_name",
                            "googleEmail", email,
                            "googleName", name
                    ));
                }

                String cleanName = requestedParticipantName.trim();
                
                // Comprobar nombres reservados para el administrador
                boolean isReservedName = appAdmins.stream().anyMatch(a -> a.equalsIgnoreCase(cleanName));
                if (isReservedName) {
                    boolean isAllowedEmail = adminEmails.stream().anyMatch(ae -> ae.equalsIgnoreCase(email));
                    if (!isAllowedEmail) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                                "error", "Ese nombre está reservado por el sistema para el administrador."
                        ));
                    }
                }

                // Comprobar si el nombre que quiere ya está pillado por OTRO usuario
                if (userAccountRepository.existsByParticipantNameIgnoreCase(cleanName)) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                            "error", "Ese nombre ya está registrado y vinculado a otra cuenta."
                    ));
                }

                // Crear nueva cuenta vinculada
                UserAccount newAccount = UserAccount.builder()
                        .googleEmail(email)
                        .googleName(name)
                        .participantName(cleanName)
                        .build();
                userAccountRepository.save(newAccount);

                // 4. Emitir el token con el email de Google
                String appToken = jwtUtil.generateToken(cleanName, email);
                return ResponseEntity.ok(Map.of(
                        "token", appToken,
                        "participantName", cleanName,
                        "status", "registered_success"
                ));
            }

        } catch (Exception e) {
            log.error("Error al procesar login con Google", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Error al procesar login con Google"));
        }
    }

    /**
     * Endpoint público para que el frontend sepa qué nombres ya no se pueden elegir.
     */
    @GetMapping("/claimed-names")
    public ResponseEntity<java.util.List<String>> getClaimedNames() {
        return ResponseEntity.ok(userAccountRepository.findAllClaimedNames());
    }
}
