package com.porra.mundial.controller;

import com.porra.mundial.dto.LeagueImageResponse;
import com.porra.mundial.model.League;
import com.porra.mundial.service.ProfileImageService;
import com.porra.mundial.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.Principal;

/**
 * Imagen de una liga.
 * <ul>
 *   <li>GET: pública (se pide desde etiquetas &lt;img&gt;, que no envían el token). La URL lleva una versión
 *       (?v=) que cambia al sustituir la imagen, por lo que se puede cachear.</li>
 *   <li>PUT / DELETE: solo el administrador de la liga.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/groups/{id}/image")
@RequiredArgsConstructor
public class GroupImageController {

    private final ProfileImageService profileImageService;
    private final WebSocketService webSocketService;

    @GetMapping
    public ResponseEntity<byte[]> getImage(@PathVariable Long id, WebRequest request) {
        return profileImageService.getLeagueImage(id)
                .map(img -> ImageResponses.serve(img, request))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LeagueImageResponse uploadImage(@PathVariable Long id,
                                           @RequestParam("file") MultipartFile file,
                                           Principal principal) throws IOException {
        League league = profileImageService.saveLeagueImage(id, principal.getName(), file.getBytes());
        webSocketService.invalidateAndNotify();
        return LeagueImageResponse.of(league);
    }

    @DeleteMapping
    public LeagueImageResponse deleteImage(@PathVariable Long id, Principal principal) {
        League league = profileImageService.deleteLeagueImage(id, principal.getName());
        webSocketService.invalidateAndNotify();
        return LeagueImageResponse.of(league);
    }
}
