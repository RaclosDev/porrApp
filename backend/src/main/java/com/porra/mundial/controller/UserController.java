package com.porra.mundial.controller;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

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
                  "participantName", user.getParticipantName(),
                  "lastSelectedGroupId", user.getLastSelectedGroupId()
              ));
         }
         return ResponseEntity.notFound().build();
    }
}
