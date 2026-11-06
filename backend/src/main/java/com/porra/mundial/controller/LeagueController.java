package com.porra.mundial.controller;

import com.porra.mundial.dto.LeagueCreateDTO;
import com.porra.mundial.dto.LeagueJoinDTO;
import com.porra.mundial.dto.LeagueMemberDTO;
import com.porra.mundial.dto.LeagueResponseDTO;
import com.porra.mundial.dto.LeagueUpdateDTO;
import com.porra.mundial.dto.JoinCodeResponse;
import com.porra.mundial.dto.LeagueSummaryDTO;
import com.porra.mundial.dto.MemberPaymentRequest;
import com.porra.mundial.dto.PaymentStatusResponse;
import com.porra.mundial.dto.StatusResponse;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.service.league.LeagueService;
import com.porra.mundial.service.league.LeagueMembershipService;
import com.porra.mundial.service.league.NewLeague;
import com.porra.mundial.service.league.LeagueSummaryService;
import com.porra.mundial.service.notification.WebSocketService;
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

    private final LeagueService leagueService;
    private final LeagueMembershipService membershipService;
    private final WebSocketService webSocketService;
    private final LeagueSummaryService leagueSummaryService;

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
     * Crea una liga; quien la crea pasa a ser su administrador. Con la cabecera
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
            group = leagueService.createLeague(new NewLeague(payload.getName().trim(), principal.getName(),
                    payload.getCompetitionId(), PoolFormat.fromString(payload.getPoolFormat()), payload.getPichichi(),
                    payload.getCustomCompetitionName(), idempotencyKey));
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

    /** Cede la administración de la liga a otro miembro. Solo el administrador. */
    @PutMapping("/{id}/members/{userId}/admin")
    public StatusResponse transferAdmin(@PathVariable Long id, @PathVariable Long userId, Principal principal) {
        membershipService.transferAdmin(id, userId, principal.getName());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success("Administración cedida");
    }

    /** Genera un código de invitación nuevo e invalida el anterior. Solo el administrador. */
    @PostMapping("/{id}/regenerate-code")
    public JoinCodeResponse regenerateCode(@PathVariable Long id, Principal principal) {
        return new JoinCodeResponse(leagueService.regenerateJoinCode(id, principal.getName()));
    }
}
