package com.porra.mundial.controller;

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
import java.util.HashMap;
import java.util.Map;

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
    public ResponseEntity<?> uploadImage(@PathVariable Long id,
                                         @RequestParam("file") MultipartFile file,
                                         Principal principal) throws IOException {
        if (principal == null) return ResponseEntity.status(401).build();
        League league = profileImageService.saveLeagueImage(id, principal.getName(), file.getBytes());
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(response(league));
    }

    @DeleteMapping
    public ResponseEntity<?> deleteImage(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        League league = profileImageService.deleteLeagueImage(id, principal.getName());
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(response(league));
    }

    private Map<String, Object> response(League league) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "success");
        body.put("imageUrl", league.getImageUrl());
        return body;
    }
}
