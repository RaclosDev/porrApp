package com.porra.mundial.controller;

import com.porra.mundial.dto.ProfileResponse;
import com.porra.mundial.dto.ProfileUpdateDTO;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.service.ProfileImageService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.Principal;

/**
 * Perfil del usuario autenticado: nombre público y foto.
 * Todas las operaciones de escritura actúan siempre sobre el usuario del token (no reciben un id),
 * de modo que nadie puede modificar el perfil de otra persona. La identidad de Google no se modifica.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final ProfileImageService profileImageService;
    private final WebSocketService webSocketService;

    @PutMapping("/me/profile")
    public ProfileResponse updateProfile(@Valid @RequestBody ProfileUpdateDTO payload, Principal principal) {
        UserAccount user = profileImageService.updateParticipantName(principal.getName(), payload.getParticipantName());
        webSocketService.notifyProfileChanged();
        return ProfileResponse.of(user);
    }

    @PutMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProfileResponse uploadAvatar(@RequestParam("file") MultipartFile file, Principal principal)
            throws IOException {
        UserAccount user = profileImageService.saveAvatar(principal.getName(), file.getBytes());
        webSocketService.notifyProfileChanged();
        return ProfileResponse.of(user);
    }

    @DeleteMapping("/me/avatar")
    public ProfileResponse deleteAvatar(Principal principal) {
        UserAccount user = profileImageService.deleteAvatar(principal.getName());
        webSocketService.notifyProfileChanged();
        return ProfileResponse.of(user);
    }

    /** Foto de perfil pública (se carga desde etiquetas &lt;img&gt;). La URL lleva versión para poder cachearla. */
    @GetMapping("/{userId}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable Long userId, WebRequest request) {
        return profileImageService.getAvatar(userId)
                .map(img -> ImageResponses.serve(img, request))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
