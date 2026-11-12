package app.porrapp.controller;

import app.porrapp.dto.LeagueCreateDTO;
import app.porrapp.dto.LeagueJoinDTO;
import app.porrapp.dto.LeagueMemberDTO;
import app.porrapp.dto.LeagueResponseDTO;
import app.porrapp.dto.LeagueUpdateDTO;
import app.porrapp.dto.JoinCodeResponse;
import app.porrapp.dto.LeagueSummaryDTO;
import app.porrapp.dto.MemberPaymentRequest;
import app.porrapp.dto.PaymentStatusResponse;
import app.porrapp.dto.StatusResponse;
import app.porrapp.model.League;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Sport;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.league.LeagueRepeatService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.LeagueSummaryService;
import app.porrapp.service.notification.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Ligas privadas: creación, invitaciones, miembros y administración de pagos y pronósticos.
 * Las rutas de escritura y las de miembros exigen sesión (ver {@code SecurityConfig});
 * los permisos de administrador los comprueban {@link LeagueService} y {@link LeagueMembershipService}.
 */
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class LeagueController {

    /** Formato admitido para la cabecera {@code Idempotency-Key} (p. ej. un UUID). */
    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("[A-Za-z0-9_-]{8,64}");

    /** Deporte de una competición personalizada; null si no se indica (se juega con empate). */
    private static Sport customSport(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Sport.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deporte no válido");
        }
    }

    private final LeagueService leagueService;
    private final LeagueSetupService leagueSetupService;
    private final LeagueMembershipService membershipService;
    private final WebSocketService webSocketService;
    private final LeagueSummaryService leagueSummaryService;
    private final LeagueRepeatService leagueRepeatService;

    /** Ligas del usuario autenticado. */
    @GetMapping("/mine")
    public List<LeagueResponseDTO> getMyLeagues(Principal principal) {
        return leagueService.getUserLeagueDTOs(principal.getName());
    }

    /** Posición, puntos y predicciones pendientes del usuario en cada una de sus ligas. */
    @GetMapping("/mine/summary")
    public List<LeagueSummaryDTO> getMyLeagueSummaries(Principal principal) {
        return leagueSummaryService.summaries(principal.getName());
    }

    /**
     * Crea una liga; quien la crea pasa a ser su administrador. Puede llegar ya configurada (normas,
     * cuota, puntuación y cierre); si algún ajuste no es válido no se crea. Con la cabecera
     * {@code Idempotency-Key}, repetir la petición devuelve la misma liga en vez de crear otra.
     */
    @PostMapping
    public LeagueResponseDTO createLeague(@Valid @RequestBody LeagueCreateDTO payload,
                                        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                        Principal principal) {
        if (idempotencyKey != null && !IDEMPOTENCY_KEY.matcher(idempotencyKey).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key no válida");
        }
        League group;
        try {
            group = leagueSetupService.create(new NewLeague(payload.getName().trim(), principal.getName(),
                    payload.getCompetitionId(), PoolFormat.fromString(payload.getPoolFormat()), payload.getPichichi(),
                    payload.getCustomCompetitionName(), idempotencyKey)
                    .withCustomSport(customSport(payload.getCustomSport())), payload.toSetup());
        } catch (DataIntegrityViolationException e) {
            // Dos peticiones con la misma clave a la vez: la segunda choca con el índice único.
            if (idempotencyKey == null) {
                throw e;
            }
            group = leagueService.findCreatedWithKey(principal.getName(), idempotencyKey).orElseThrow(() -> e);
        }
        return leagueService.toResponse(group, true);
    }

    /** Cambia el nombre, las reglas o la cuota de una liga. Solo el administrador. */
    @PutMapping("/{id}")
    public LeagueResponseDTO updateLeague(@PathVariable Long id, @Valid @RequestBody LeagueUpdateDTO payload, Principal principal) {
        League group = leagueService.updateLeague(id, payload.getName(), payload.getRules(), payload.getEntryFee(), principal.getName());
        return leagueService.toResponse(group, true);
    }

    /** Elimina la liga con todos sus pronósticos. Solo el administrador. */
    @DeleteMapping("/{id}")
    public StatusResponse deleteLeague(@PathVariable Long id, Principal principal) {
        leagueService.deleteLeague(id, principal.getName());
        return StatusResponse.success();
    }

    /** Une al usuario a la liga del código de invitación. */
    @PostMapping("/join")
    public LeagueResponseDTO joinLeague(@Valid @RequestBody LeagueJoinDTO payload, Principal principal) {
        League group = leagueService.getLeagueByJoinCode(payload.getJoinCode().trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo no encontrado con ese código"));
        membershipService.join(group.getId(), principal.getName());
        // Refresca ranking, miembros y contadores de esa liga en las sesiones que la estén viendo.
        webSocketService.notifyLeagueChanged(group.getId());
        return leagueService.toResponse(group, true);
    }

    /** Metadatos públicos para previsualizar una invitación sin unirse. */
    @GetMapping("/preview/{code}")
    public LeagueResponseDTO previewLeagueInvitation(@PathVariable String code) {
        return leagueService.findInvitationPreview(code.trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitación no válida o caducada"));
    }

    /** La liga pública destacada (portada y demo), o 404 si no hay ninguna. */
    @GetMapping("/featured")
    public LeagueResponseDTO getFeaturedLeague(Principal principal) {
        return leagueService.findFeaturedLeagueResponse(principal != null ? principal.getName() : null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No hay ninguna liga pública"));
    }

    /** Detalle de una liga. El código de invitación solo lo ven sus miembros. */
    @GetMapping("/{id}")
    public LeagueResponseDTO getLeague(@PathVariable Long id, Principal principal) {
        return leagueService.findLeagueResponse(id, principal != null ? principal.getName() : null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo no encontrado"));
    }

    /** El usuario abandona la liga. */
    @DeleteMapping("/{id}/leave")
    public StatusResponse leaveLeague(@PathVariable Long id, Principal principal) {
        membershipService.leave(id, principal.getName());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success();
    }

    /** Miembros de la liga con su rol y estado de pago. */
    @GetMapping("/{id}/members")
    public List<LeagueMemberDTO> getMembers(@PathVariable Long id, Principal principal) {
        return membershipService.members(id, principal.getName());
    }

    /** Marca o desmarca el pago de un miembro. Solo el administrador. */
    @PutMapping("/{id}/members/{userId}/payment")
    public PaymentStatusResponse updateMemberPayment(@PathVariable Long id, @PathVariable Long userId,
                                                     @Valid @RequestBody MemberPaymentRequest body, Principal principal) {
        String status = body.statusOrDefault();
        membershipService.setPayment(id, userId, principal.getName(), status);
        webSocketService.notifyLeagueChanged(id);
        return PaymentStatusResponse.success(status);
    }

    /** Expulsa a un participante. Solo el administrador. */
    @DeleteMapping("/{id}/members/{userId}")
    public StatusResponse kickMember(@PathVariable Long id, @PathVariable Long userId, Principal principal) {
        membershipService.kick(id, userId, principal.getName());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success("Miembro expulsado");
    }

    public record MemberRoleRequest(
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.Pattern(regexp = "ADMIN|MEMBER|ORGANIZER") String role) {}

    @PutMapping("/{id}/members/{userId}/role")
    public StatusResponse setMemberRole(@PathVariable Long id, @PathVariable Long userId,
            @Valid @RequestBody MemberRoleRequest request, Principal principal) {
        membershipService.setRole(id, userId, principal.getName(), request.role());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success("Permisos actualizados");
    }

    /** Cede la propiedad de la liga a otro miembro. Solo el creador. */
    @PutMapping("/{id}/members/{userId}/admin")
    public StatusResponse transferAdmin(@PathVariable Long id, @PathVariable Long userId, Principal principal) {
        membershipService.transferAdmin(id, userId, principal.getName());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success("Administración cedida");
    }

    /**
     * Repite una liga terminada para la temporada nueva de su competición: otra liga con los mismos miembros
     * y ajustes. Solo el administrador; repetir la petición devuelve la liga ya creada.
     */
    @PostMapping("/{id}/repeat")
    public LeagueResponseDTO repeatLeague(@PathVariable Long id, Principal principal) {
        League repeated = leagueRepeatService.repeat(id, principal.getName());
        // Los miembros que estén viendo la liga terminada reciben la nueva sin recargar.
        webSocketService.notifyLeagueChanged(id);
        return leagueService.toResponse(repeated, true);
    }

    /** Genera un código de invitación nuevo e invalida el anterior. Solo el administrador. */
    @PostMapping("/{id}/regenerate-code")
    public JoinCodeResponse regenerateCode(@PathVariable Long id, Principal principal) {
        return new JoinCodeResponse(leagueService.regenerateJoinCode(id, principal.getName()));
    }
}
