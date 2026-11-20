package app.porrapp.controller;

import app.porrapp.dto.AdminAnnouncementRequest;
import app.porrapp.dto.AdminAnnouncementResult;
import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.service.admin.AdminAnnouncementService;
import app.porrapp.service.admin.AdminAccess;
import app.porrapp.service.admin.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * Panel de administración: cifras de solo lectura y avisos push a ligas. Nada de la app lo enlaza ni lo documenta; quien no es
 * administrador (ver {@link AdminAccess}) recibe un 404.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAccess access;
    private final AdminService service;
    private final AdminAnnouncementService announcements;

    @GetMapping("/overview")
    public ResponseEntity<AdminOverviewDTO> overview(Principal principal) {
        access.requireAdmin(CurrentUser.email(principal));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.overview());
    }

    /** Manda un aviso push a los miembros de las ligas elegidas. */
    @PostMapping("/announcements")
    public ResponseEntity<AdminAnnouncementResult> announce(Principal principal,
                                                            @RequestBody AdminAnnouncementRequest request) {
        String email = CurrentUser.email(principal);
        access.requireAdmin(email);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(announcements.send(email, request));
    }
}
