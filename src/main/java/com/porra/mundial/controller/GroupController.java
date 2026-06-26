package com.porra.mundial.controller;

import com.porra.mundial.model.BetGroup;
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
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final EditionRepository editionRepository;
    private final com.porra.mundial.service.WebSocketService webSocketService;

    @GetMapping("/mine")
    public ResponseEntity<?> getMyGroups(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No autorizado"));
        }
        
        List<GroupResponseDTO> mapped = groupService.getUserGroupDTOs(principal.getName());
        return ResponseEntity.ok(mapped);
    }

    @PostMapping
    public ResponseEntity<?> createGroup(@Valid @RequestBody GroupCreateDTO payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        
        com.porra.mundial.model.BetMode betMode = com.porra.mundial.model.BetMode.valueOf(payload.getBetMode());
        BetGroup group = groupService.createGroup(payload.getName().trim(), principal.getName(), payload.getCompetitionId(), betMode, payload.getPichichi());
        return ResponseEntity.ok(group);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateGroup(@PathVariable Long id, @Valid @RequestBody GroupUpdateDTO payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        BetGroup group = groupService.updateGroupName(id, payload.getName(), principal.getName());
        return ResponseEntity.ok(group);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.deleteGroup(id, principal.getName());
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(@Valid @RequestBody GroupJoinDTO payload, Principal principal) {
        Optional<BetGroup> group = groupService.getGroupByJoinCode(payload.getJoinCode().trim().toUpperCase());
        if (group.isPresent()) {
            if (principal != null) {
                groupService.joinGroupMembership(group.get().getId(), principal.getName());
            }
            return ResponseEntity.ok(group.get());
        }
        return ResponseEntity.status(404).body(Map.of("error", "Grupo no encontrado con ese código"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getGroup(@PathVariable Long id) {
        Optional<BetGroup> group = groupService.getGroupById(id);
        if (group.isPresent()) {
            BetGroup g = group.get();
            GroupResponseDTO.GroupResponseDTOBuilder builder = GroupResponseDTO.builder()
                    .id(g.getId())
                    .name(g.getName())
                    .joinCode(g.getJoinCode())
                    .adminParticipantName(g.getAdminParticipantName())
                    .adminUserId(g.getAdminUserId())
                    .createdAt(g.getCreatedAt());
                    
            editionRepository.findByLeagueIdAndStatus(g.getId(), "ACTIVE").ifPresent(e -> {
                builder.competitionName(e.getCompetition().getName())
                       .betMode(e.getBetMode().name())
                       .pichichi(e.isPichichi());
            });
            
            return ResponseEntity.ok(builder.build());
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}/leave")
    public ResponseEntity<?> leaveGroup(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.leaveGroup(id, principal.getName());
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    @GetMapping("/{id}/bets")
    public ResponseEntity<?> getGroupBetsAdmin(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(groupService.getGroupBetsForAdmin(id, principal.getName()));
    }

    @PutMapping("/{id}/bets/{betId}/accept")
    public ResponseEntity<?> acceptBetAdmin(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Object result = groupService.toggleBetPaymentStatus(id, betId, principal.getName(), true);
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/bets/{betId}/reject")
    public ResponseEntity<?> rejectBet(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(groupService.toggleBetPaymentStatus(id, betId, principal.getName(), false));
    }

    @DeleteMapping("/{id}/bets/{betId}")
    public ResponseEntity<?> deleteBetAdmin(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        groupService.deleteBet(id, betId, principal.getName());
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(Map.of("status", "success"));
    }
}
