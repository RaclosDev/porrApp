package app.porrapp.controller;

import app.porrapp.dto.AdminAnnouncementRequest;
import app.porrapp.dto.AdminAnnouncementResult;
import app.porrapp.dto.AdminIncidentDTO;
import app.porrapp.dto.AdminLeaguePlanRequest;
import app.porrapp.dto.AdminOverviewDTO;
import app.porrapp.service.admin.AdminAnnouncementService;
import app.porrapp.service.admin.AdminAccess;
import app.porrapp.service.admin.AdminIncidentService;
import app.porrapp.service.admin.AdminLeaguePlanService;
import app.porrapp.service.admin.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * Panel de administración: cifras de solo lectura, avisos push a ligas e incidencias de resultados. Nada de la app lo enlaza ni lo documenta; quien no es
 * administrador (ver {@link AdminAccess}) recibe un 404.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAccess access;
    private final AdminService service;
    private final AdminAnnouncementService announcements;
    private final AdminIncidentService incidents;
    private final AdminLeaguePlanService plans;

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
    /** Cambia el plan de una liga y si tiene música en la TV de póker. */
    @PutMapping("/leagues/{id}/plan")
    public ResponseEntity<Void> setLeaguePlan(Principal principal, @PathVariable Long id,
                                              @Valid @RequestBody AdminLeaguePlanRequest request) {
        access.requireAdmin(CurrentUser.email(principal));
        plans.set(id, request.plan(), request.pokerMusic());
        return ResponseEntity.noContent().build();
    }

    /** Resultados que la sincronización ha retenido: las abiertas y las últimas resueltas. */
    @GetMapping("/incidents")
    public ResponseEntity<List<AdminIncidentDTO>> incidents(Principal principal) {
        access.requireAdmin(CurrentUser.email(principal));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(incidents.list());
    }

    /** Aplica lo que mandó el proveedor. */
    @PostMapping("/incidents/{id}/apply")
    public ResponseEntity<AdminIncidentDTO> applyIncident(Principal principal, @PathVariable Long id) {
        access.requireAdmin(CurrentUser.email(principal));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(incidents.apply(id));
    }

    /** Mantiene el resultado guardado. */
    @PostMapping("/incidents/{id}/dismiss")
    public ResponseEntity<AdminIncidentDTO> dismissIncident(Principal principal, @PathVariable Long id) {
        access.requireAdmin(CurrentUser.email(principal));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(incidents.dismiss(id));
    }
}
