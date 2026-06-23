package com.porra.mundial.controller;

import com.porra.mundial.model.BetGroup;
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
        
        List<BetGroup> groups = groupService.getUserGroups(principal.getName());
        List<Map<String, Object>> mapped = new java.util.ArrayList<>();
        for (BetGroup g : groups) {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", g.getId());
            map.put("name", g.getName());
            map.put("joinCode", g.getJoinCode());
            map.put("adminParticipantName", g.getAdminParticipantName());
            map.put("adminUserId", g.getAdminUserId());
            editionRepository.findByLeagueIdAndStatus(g.getId(), "ACTIVE").ifPresent(e -> {
                map.put("competitionName", e.getCompetition().getName());
                map.put("betMode", e.getBetMode().name());
                map.put("pichichi", e.isPichichi());
            });
            mapped.add(map);
        }
        
        return ResponseEntity.ok(mapped);
    }

    @PostMapping
    public ResponseEntity<?> createGroup(@RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String name = payload.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El nombre del grupo es obligatorio"));
        }
        
        String compStr = payload.get("competitionId");
        String modeStr = payload.get("betMode");
        if (compStr == null || modeStr == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Competición y tipo de porra son obligatorios"));
        }

        String pichichiStr = payload.get("pichichi");
        boolean pichichi = pichichiStr == null || Boolean.parseBoolean(pichichiStr);

        try {
            Long compId = Long.parseLong(compStr);
            com.porra.mundial.model.BetMode betMode = com.porra.mundial.model.BetMode.valueOf(modeStr);
            BetGroup group = groupService.createGroup(name.trim(), principal.getName(), compId, betMode, pichichi);
            return ResponseEntity.ok(group);
        } catch (IllegalArgumentException e) {
             return ResponseEntity.badRequest().body(Map.of("error", "Parámetros inválidos: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateGroup(@PathVariable Long id, @RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            BetGroup group = groupService.updateGroupName(id, payload.get("name"), principal.getName());
            return ResponseEntity.ok(group);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            groupService.deleteGroup(id, principal.getName());
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(@RequestBody Map<String, String> payload) {
        String joinCode = payload.get("joinCode");
        if (joinCode == null || joinCode.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El código es obligatorio"));
        }
        Optional<BetGroup> group = groupService.getGroupByJoinCode(joinCode.trim().toUpperCase());
        if (group.isPresent()) {
            return ResponseEntity.ok(group.get());
        }
        return ResponseEntity.status(404).body(Map.of("error", "Grupo no encontrado con ese código"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getGroup(@PathVariable Long id) {
        Optional<BetGroup> group = groupService.getGroupById(id);
        if (group.isPresent()) {
            BetGroup g = group.get();
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", g.getId());
            map.put("name", g.getName());
            map.put("joinCode", g.getJoinCode());
            map.put("adminParticipantName", g.getAdminParticipantName());
            map.put("adminUserId", g.getAdminUserId());
            map.put("createdAt", g.getCreatedAt());
            editionRepository.findByLeagueIdAndStatus(g.getId(), "ACTIVE").ifPresent(e -> {
                map.put("competitionName", e.getCompetition().getName());
                map.put("betMode", e.getBetMode().name());
                map.put("pichichi", e.isPichichi());
            });
            return ResponseEntity.ok(map);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}/leave")
    public ResponseEntity<?> leaveGroup(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            groupService.leaveGroup(id, principal.getName());
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/bets")
    public ResponseEntity<?> getGroupBetsAdmin(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            return ResponseEntity.ok(groupService.getGroupBetsForAdmin(id, principal.getName()));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/bets/{betId}/accept")
    public ResponseEntity<?> acceptBetAdmin(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            Object result = groupService.toggleBetPaymentStatus(id, betId, principal.getName(), true);
            
            webSocketService.invalidateAndNotify();

            return ResponseEntity.ok(result);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/bets/{betId}/reject")
    public ResponseEntity<?> rejectBet(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            return ResponseEntity.ok(groupService.toggleBetPaymentStatus(id, betId, principal.getName(), false));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/bets/{betId}")
    public ResponseEntity<?> deleteBetAdmin(@PathVariable Long id, @PathVariable Long betId, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        try {
            groupService.deleteBet(id, betId, principal.getName());
            
            webSocketService.invalidateAndNotify();

            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
