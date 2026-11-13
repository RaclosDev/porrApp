package app.porrapp.controller;

import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.service.admin.AdminAccess;
import app.porrapp.service.admin.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * Panel de administración, solo lectura. Nada de la app lo enlaza ni lo documenta; quien no es
 * administrador (ver {@link AdminAccess}) recibe un 404.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAccess access;
    private final AdminService service;

    @GetMapping("/overview")
    public ResponseEntity<AdminOverviewDTO> overview(Principal principal) {
        access.requireAdmin(CurrentUser.email(principal));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.overview());
    }
}
