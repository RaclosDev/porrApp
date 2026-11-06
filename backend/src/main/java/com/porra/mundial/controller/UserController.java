package com.porra.mundial.controller;

import com.porra.mundial.dto.MeResponse;
import com.porra.mundial.dto.StatusResponse;
import com.porra.mundial.dto.UserDataExport;
import com.porra.mundial.dto.UserPreferencesRequest;
import com.porra.mundial.service.AccountDeletionService;
import com.porra.mundial.service.UserDataExportService;
import com.porra.mundial.service.UserService;
import com.porra.mundial.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * Información del usuario autenticado y preferencias que deben persistir entre sesiones
 * (por ejemplo, la última liga abierta). Todas las rutas exigen sesión.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AccountDeletionService accountDeletionService;
    private final WebSocketService webSocketService;
    private final UserDataExportService userDataExportService;

    /** "Quién soy": lo usa la SPA al arrancar con un token guardado. */
    @GetMapping("/me")
    public MeResponse getMe(Principal principal) {
        return userService.getMe(principal.getName());
    }

    @PutMapping("/me/profile-setup")
    public StatusResponse completeProfileSetup(Principal principal) {
        userService.completeProfileSetup(principal.getName());
        return StatusResponse.success();
    }

    /** Borra la cuenta y todos sus datos (derecho de supresión) y cierra la sesión de este navegador. */
    @DeleteMapping("/me")
    public ResponseEntity<StatusResponse> deleteMe(Principal principal) {
        accountDeletionService.deleteAccount(principal.getName());
        webSocketService.notifyProfileChanged();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, RefreshTokenCookie.cleared())
                .body(StatusResponse.success("Cuenta borrada"));
    }

    /** Descarga de los datos personales propios en JSON (derecho de acceso y portabilidad). */
    @GetMapping("/me/export")
    public ResponseEntity<UserDataExport> exportMe(Principal principal) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"porra-mis-datos.json\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(userDataExportService.export(principal.getName()));
    }

    @PutMapping("/me/preferences")
    public StatusResponse updatePreferences(@RequestBody UserPreferencesRequest payload, Principal principal) {
        userService.updateLastSelectedGroup(principal.getName(), payload.lastSelectedGroupId());
        return StatusResponse.success();
    }
}
