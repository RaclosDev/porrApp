package com.porra.mundial.controller;

import com.porra.mundial.dto.GroupMemberDTO;
import java.util.Map;
import com.porra.mundial.model.League;
import com.porra.mundial.dto.GroupCreateDTO;
import com.porra.mundial.dto.GroupUpdateDTO;
import com.porra.mundial.dto.GroupJoinDTO;
import com.porra.mundial.dto.GroupResponseDTO;
import jakarta.validation.Valid;
import com.porra.mundial.model.Edition;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;
import java.util.Optional;




/**
 * Controlador REST para la gestión de Grupos (Ligas Privadas).
 * Permite a los usuarios crear grupos, unirse mediante códigos de invitación,
 * y a los administradores gestionar los miembros y validar los pagos de sus apuestas.
 */
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final EditionRepository editionRepository;
    private final com.porra.mundial.service.WebSocketService webSocketService;

    /**
     * Obtiene la lista de grupos a los que pertenece el usuario autenticado.
     * 
     * @param principal Identidad del usuario inyectada por Spring Security a partir del JWT.
     * @return Lista de GroupResponseDTO con los detalles de los grupos.
     */
    @GetMapping("/mine")
    public ResponseEntity<?> getMyGroups(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autorizado"));
        }
        
        List<GroupResponseDTO> mapped = groupService.getUserGroupDTOs(principal.getName());
        return ResponseEntity.ok(mapped);
    }

    /**
     * Crea un nuevo grupo privado en el sistema.
     * El usuario que lo crea se convierte automáticamente en su administrador.
     * 
     * @param payload Datos para la creación (Nombre del grupo, Competición, Modo de Apuesta, etc.).
     * @param principal Identidad del usuario creador.
     * @return El grupo recién creado (incluyendo su código de invitación generado).
     */
    @PostMapping
    public ResponseEntity<?> createGroup(@Valid @RequestBody GroupCreateDTO payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        
        com.porra.mundial.model.PoolFormat poolFormat = com.porra.mundial.model.PoolFormat.fromString(payload.resolveFormat());
        League group = groupService.createGroup(payload.getName().trim(), principal.getName(), payload.getCompetitionId(), poolFormat, payload.getPichichi());
        return ResponseEntity.ok(group);
    }

    /**
     * Actualiza la información básica de un grupo (p.ej. su nombre).
     * Solo puede ser invocado por el administrador del grupo.
     * 
     * @param id ID del grupo a modificar.
     * @param payload Nuevos datos del grupo.
     * @param principal Identidad del usuario (para verificar que es el admin).
     * @return El grupo actualizado.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateGroup(@PathVariable Long id, @Valid @RequestBody GroupUpdateDTO payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        League group = groupService.updateGroupName(id, payload.getName(), principal.getName());
        return ResponseEntity.ok(group);
    }

    /**
     * Elimina por completo un grupo y todas las apuestas asociadas a él.
     * Solo puede ser invocado por el administrador del grupo.
     * 
     * @param id ID del grupo a eliminar.
     * @param principal Identidad del usuario (para verificar que es el admin).
     * @return Estado de la operación.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.deleteGroup(id, principal.getName());
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    /**
     * Permite a un usuario unirse a un grupo existente proporcionando su código de invitación (ej: "A1B2C").
     * 
     * @param payload Contiene el código de invitación alfanumérico.
     * @param principal Identidad del usuario que se une.
     * @return El grupo al que se acaba de unir o un error 404 si el código no es válido.
     */
    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(@Valid @RequestBody GroupJoinDTO payload, Principal principal) {
        Optional<League> group = groupService.getGroupByJoinCode(payload.getJoinCode().trim().toUpperCase());
        if (group.isPresent()) {
            if (principal != null) {
                groupService.joinGroupMembership(group.get().getId(), principal.getName());
            }
            return ResponseEntity.ok(group.get());
        }
        return ResponseEntity.status(404).body(Map.of("error", "Grupo no encontrado con ese código"));
    }

    /**
     * Obtiene los detalles públicos de un grupo a partir de su ID.
     * Se usa por ejemplo cuando se accede directamente a la URL de un grupo.
     * 
     * @param id ID del grupo.
     * @return GroupResponseDTO con la información detallada.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getGroup(@PathVariable Long id, Principal principal) {
        Optional<League> group = groupService.getGroupById(id);
        if (group.isPresent()) {
            League g = group.get();
            String email = principal != null ? principal.getName() : null;
            boolean isMember = email != null && groupService.isUserMemberOrAdmin(id, email);

            GroupResponseDTO.GroupResponseDTOBuilder builder = GroupResponseDTO.builder()
                    .id(g.getId())
                    .name(g.getName())
                    .joinCode(isMember ? g.getJoinCode() : null)
                    .adminParticipantName(g.getAdminParticipantName())
                    .adminUserId(g.getAdminUserId())
                    .createdAt(g.getCreatedAt());
                    
            // Busca la edición activa vinculada a este grupo para extraer metadatos
            editionRepository.findByLeagueIdAndStatus(g.getId(), "ACTIVE").ifPresent(e -> {
                builder.competitionId(e.getCompetition() != null ? e.getCompetition().getId() : null)
                       .competitionName(e.getCompetition() != null ? e.getCompetition().getName() : null)
                       .formatType(e.getCompetition() != null ? e.getCompetition().getFormatType() : null)
                       .betMode(e.getBetMode() != null ? e.getBetMode().name() : null)
                       .poolFormat(e.getPoolFormat() != null ? e.getPoolFormat().name() : null)
                       .pichichi(e.isPichichi())
                       .lockDate(e.getLockDate())
                       .isLocked(e.isLocked());
            });
            
            return ResponseEntity.ok(builder.build());
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * Permite a un usuario salirse voluntariamente de un grupo.
     * Si el usuario tenía apuestas en el grupo, estas pueden o no eliminarse dependiendo de la regla de negocio.
     * 
     * @param id ID del grupo a abandonar.
     * @param principal Identidad del usuario.
     */
    @DeleteMapping("/{id}/leave")
    public ResponseEntity<?> leaveGroup(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.leaveGroup(id, principal.getName());
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    /**
     * Listado de apuestas de un grupo exclusivo para la vista de Administración del Grupo.
     * 
     * @param id ID del grupo.
     * @param principal Identidad del usuario (debe coincidir con el administrador del grupo).
     * @return Lista de apuestas con datos adicionales de gestión.
     */
    @GetMapping({"/{id}/bets", "/{id}/predictions"})
    public ResponseEntity<?> getGroupBetsAdmin(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(groupService.getGroupBetsForAdmin(id, principal.getName()));
    }

    /**
     * El administrador del grupo marca una apuesta como "Aceptada" o "Pagada" (PAID).
     * Esto normalmente la hace visible en el leaderboard.
     */
    @PutMapping({"/{id}/bets/{betId}/accept", "/{id}/predictions/{betId}/accept"})
    public ResponseEntity<?> acceptBetAdmin(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Object result = groupService.toggleBetPaymentStatus(id, betId, principal.getName(), true);
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(result);
    }

    /**
     * El administrador del grupo revoca el estado de "Pagado" de una apuesta.
     */
    @PutMapping({"/{id}/bets/{betId}/reject", "/{id}/predictions/{betId}/reject"})
    public ResponseEntity<?> rejectBet(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(groupService.toggleBetPaymentStatus(id, betId, principal.getName(), false));
    }

    /**
     * El administrador del grupo elimina una apuesta del grupo por ser inválida, morosa, etc.
     */
    @DeleteMapping({"/{id}/bets/{betId}", "/{id}/predictions/{betId}"})
    public ResponseEntity<?> deleteBetAdmin(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.deleteBet(id, betId, principal.getName());
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    /**
     * Obtiene los miembros de la liga con su rol y estado de pago.
     */
    @GetMapping("/{id}/members")
    public ResponseEntity<?> getMembers(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        List<GroupMemberDTO> members = groupService.getGroupMembers(id, principal.getName());
        return ResponseEntity.ok(members);
    }

    /**
     * El administrador del grupo marca o desmarca el pago de un miembro.
     */
    @PutMapping("/{id}/members/{userId}/payment")
    public ResponseEntity<?> toggleMemberPayment(
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestBody Map<String, String> body,
            Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String status = body != null ? body.getOrDefault("status", "PAID") : "PAID";
        groupService.toggleMemberPayment(id, userId, principal.getName(), status);
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(Map.of("status", "success", "paymentStatus", status));
    }

    /**
     * El administrador del grupo expulsa a un participante.
     */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<?> kickMember(
            @PathVariable Long id,
            @PathVariable Long userId,
            Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.kickMember(id, userId, principal.getName());
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(Map.of("status", "success", "message", "Miembro expulsado"));
    }

    /**
     * Regenera el código de invitación de la liga.
     */
    @PostMapping("/{id}/regenerate-code")
    public ResponseEntity<?> regenerateCode(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String newCode = groupService.regenerateJoinCode(id, principal.getName());
        return ResponseEntity.ok(Map.of("joinCode", newCode));
    }

    /**
     * Obtiene los participantes que aún no han pronosticado la jornada.
     */
    @GetMapping({"/{id}/missing-users", "/{id}/jornadas/{round}/missing-users"})
    public ResponseEntity<?> getMissingMembers(
            @PathVariable Long id,
            @PathVariable(required = false) String round,
            Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Map<String, Object> result = groupService.getMissingMembersForRound(id, principal.getName(), round);
        return ResponseEntity.ok(result);
    }
}