package com.porra.mundial.controller;

import com.porra.mundial.dto.GroupCreateDTO;
import com.porra.mundial.dto.GroupJoinDTO;
import com.porra.mundial.dto.GroupMemberDTO;
import com.porra.mundial.dto.GroupResponseDTO;
import com.porra.mundial.dto.GroupUpdateDTO;
import com.porra.mundial.dto.JoinCodeResponse;
import com.porra.mundial.dto.MemberPaymentRequest;
import com.porra.mundial.dto.PaymentStatusResponse;
import com.porra.mundial.dto.StatusResponse;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

/**
 * Ligas privadas: creación, invitaciones, miembros y administración de pagos y pronósticos.
 * Las rutas de escritura y las de miembros exigen sesión (ver {@code SecurityConfig});
 * los permisos de administrador los comprueba {@link GroupService}.
 */
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final WebSocketService webSocketService;

    /** Ligas del usuario autenticado. */
    @GetMapping("/mine")
    public List<GroupResponseDTO> getMyGroups(Principal principal) {
        return groupService.getUserGroupDTOs(principal.getName());
    }

    /** Crea una liga; quien la crea pasa a ser su administrador. */
    @PostMapping
    public GroupResponseDTO createGroup(@Valid @RequestBody GroupCreateDTO payload, Principal principal) {
        League group = groupService.createGroup(payload.getName().trim(), principal.getName(), payload.getCompetitionId(),
                PoolFormat.fromString(payload.getPoolFormat()), payload.getPichichi());
        return groupService.toResponse(group, true);
    }

    /** Cambia el nombre o las reglas de una liga. Solo el administrador. */
    @PutMapping("/{id}")
    public GroupResponseDTO updateGroup(@PathVariable Long id, @Valid @RequestBody GroupUpdateDTO payload, Principal principal) {
        League group = groupService.updateGroup(id, payload.getName(), payload.getRules(), principal.getName());
        return groupService.toResponse(group, true);
    }

    /** Elimina la liga con todos sus pronósticos. Solo el administrador. */
    @DeleteMapping("/{id}")
    public StatusResponse deleteGroup(@PathVariable Long id, Principal principal) {
        groupService.deleteGroup(id, principal.getName());
        return StatusResponse.success();
    }

    /** Une al usuario a la liga del código de invitación. */
    @PostMapping("/join")
    public GroupResponseDTO joinGroup(@Valid @RequestBody GroupJoinDTO payload, Principal principal) {
        League group = groupService.getGroupByJoinCode(payload.getJoinCode().trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo no encontrado con ese código"));
        groupService.joinGroupMembership(group.getId(), principal.getName());
        // Refresca ranking, miembros y contadores de esa liga en las sesiones que la estén viendo.
        webSocketService.notifyLeagueChanged(group.getId());
        return groupService.toResponse(group, true);
    }

    /** Metadatos públicos para previsualizar una invitación sin unirse. */
    @GetMapping("/preview/{code}")
    public GroupResponseDTO previewGroupInvitation(@PathVariable String code) {
        return groupService.findInvitationPreview(code.trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitación no válida o caducada"));
    }

    /** Detalle de una liga. El código de invitación solo lo ven sus miembros. */
    @GetMapping("/{id}")
    public GroupResponseDTO getGroup(@PathVariable Long id, Principal principal) {
        return groupService.findGroupResponse(id, principal != null ? principal.getName() : null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo no encontrado"));
    }

    /** El usuario abandona la liga. */
    @DeleteMapping("/{id}/leave")
    public StatusResponse leaveGroup(@PathVariable Long id, Principal principal) {
        groupService.leaveGroup(id, principal.getName());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success();
    }

    /** Miembros de la liga con su rol y estado de pago. */
    @GetMapping("/{id}/members")
    public List<GroupMemberDTO> getMembers(@PathVariable Long id, Principal principal) {
        return groupService.getGroupMembers(id, principal.getName());
    }

    /** Marca o desmarca el pago de un miembro. Solo el administrador. */
    @PutMapping("/{id}/members/{userId}/payment")
    public PaymentStatusResponse updateMemberPayment(@PathVariable Long id, @PathVariable Long userId,
                                                     @Valid @RequestBody MemberPaymentRequest body, Principal principal) {
        String status = body.statusOrDefault();
        groupService.toggleMemberPayment(id, userId, principal.getName(), status);
        webSocketService.notifyLeagueChanged(id);
        return PaymentStatusResponse.success(status);
    }

    /** Expulsa a un participante. Solo el administrador. */
    @DeleteMapping("/{id}/members/{userId}")
    public StatusResponse kickMember(@PathVariable Long id, @PathVariable Long userId, Principal principal) {
        groupService.kickMember(id, userId, principal.getName());
        webSocketService.notifyLeagueChanged(id);
        return StatusResponse.success("Miembro expulsado");
    }

    /** Genera un código de invitación nuevo e invalida el anterior. Solo el administrador. */
    @PostMapping("/{id}/regenerate-code")
    public JoinCodeResponse regenerateCode(@PathVariable Long id, Principal principal) {
        return new JoinCodeResponse(groupService.regenerateJoinCode(id, principal.getName()));
    }
}
