package com.porra.mundial.controller;

import com.porra.mundial.dto.MeResponse;
import com.porra.mundial.dto.StatusResponse;
import com.porra.mundial.dto.UserPreferencesRequest;
import com.porra.mundial.service.UserService;
import lombok.RequiredArgsConstructor;
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

    @PutMapping("/me/preferences")
    public StatusResponse updatePreferences(@RequestBody UserPreferencesRequest payload, Principal principal) {
        userService.updateLastSelectedGroup(principal.getName(), payload.lastSelectedGroupId());
        return StatusResponse.success();
    }
}
