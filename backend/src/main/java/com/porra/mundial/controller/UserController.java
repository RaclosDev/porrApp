package com.porra.mundial.controller;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Controlador REST para el perfil de Usuario Autenticado.
 * Permite al usuario consultar su propia información y guardar preferencias
 * en la base de datos que deben persistir entre sesiones (ej: su grupo activo favorito).
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserAccountRepository userAccountRepository;

    /**
     * Guarda preferencias de interfaz del usuario (ej: El último grupo que tenía seleccionado en el dashboard).
     * 
     * @param payload JSON con las preferencias a actualizar.
     * @param principal Identidad inyectada automáticamente desde el JWT por Spring Security.
     * @return Status 200 OK en caso de éxito.
     */
    private static final Pattern IMAGE_DATA_URL = Pattern.compile("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$");

    @PutMapping("/me/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Optional<UserAccount> userOpt = userAccountRepository.findByGoogleEmail(principal.getName()).or(() -> userAccountRepository.findByParticipantNameIgnoreCase(principal.getName()));
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();
        UserAccount user = userOpt.get();
        if (payload.containsKey("participantName")) {
            String name = payload.get("participantName") == null ? "" : payload.get("participantName").trim();
            if (name.length() < 2 || name.length() > 40) return ResponseEntity.badRequest().body(Map.of("error", "El nombre debe tener entre 2 y 40 caracteres"));
            Optional<UserAccount> existing = userAccountRepository.findByParticipantNameIgnoreCase(name);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) return ResponseEntity.status(409).body(Map.of("error", "Ese nombre ya está en uso"));
            user.setParticipantName(name);
        }
        if (payload.containsKey("profileImageData")) {
            String image = payload.get("profileImageData");
            if (image != null && !image.isBlank() && (!IMAGE_DATA_URL.matcher(image).matches() || image.length() > 1000000)) return ResponseEntity.badRequest().body(Map.of("error", "La imagen debe ser PNG, JPG o WebP y pesar menos de 750 KB"));
            user.setProfileImageData(image == null || image.isBlank() ? null : image);
        }
        userAccountRepository.save(user);
        return ResponseEntity.ok(Map.of("participantName", user.getParticipantName(), "profileImageData", user.getProfileImageData() == null ? "" : user.getProfileImageData()));
    }

    @PutMapping("/me/preferences")
    public ResponseEntity<?> updatePreferences(@RequestBody Map<String, Object> payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Optional<UserAccount> userOpt = userAccountRepository.findByGoogleEmail(principal.getName()).or(() -> userAccountRepository.findByParticipantNameIgnoreCase(principal.getName()));
        if (userOpt.isPresent()) {
            UserAccount user = userOpt.get();
            if (payload.containsKey("lastSelectedGroupId")) {
                Number groupId = (Number) payload.get("lastSelectedGroupId");
                user.setLastSelectedGroupId(groupId != null ? groupId.longValue() : null);
                userAccountRepository.save(user);
            }
            return ResponseEntity.ok(Map.of("status", "success"));
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Obtiene el perfil público e interno del propio usuario logueado.
     * Útil para que la SPA en React sepa "Quién soy" cuando arranca
     * con un token válido guardado en LocalStorage.
     * 
     * @param principal Identidad inyectada automáticamente desde el JWT.
     * @return JSON con nombre de participante y últimas preferencias.
     */
    @GetMapping("/me")
    public ResponseEntity<?> getMe(Principal principal) {
         if (principal == null) return ResponseEntity.status(401).build();
         Optional<UserAccount> userOpt = userAccountRepository.findByGoogleEmail(principal.getName()).or(() -> userAccountRepository.findByParticipantNameIgnoreCase(principal.getName()));
         if (userOpt.isPresent()) {
              UserAccount user = userOpt.get();
              return ResponseEntity.ok(Map.of(
                  "participantName", com.porra.mundial.util.TextSanitizer.fixParticipantName(user.getParticipantName()),
                  "lastSelectedGroupId", user.getLastSelectedGroupId() == null ? "" : user.getLastSelectedGroupId(),
                  "profileImageData", user.getProfileImageData() == null ? "" : user.getProfileImageData()
              ));
         }
         return ResponseEntity.notFound().build();
    }
}
