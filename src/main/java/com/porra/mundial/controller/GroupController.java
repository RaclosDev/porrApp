package com.porra.mundial.controller;

import com.porra.mundial.model.BetGroup;
import com.porra.mundial.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final org.springframework.cache.CacheManager cacheManager;
    private final com.porra.mundial.service.SseService sseService;

    @GetMapping("/mine")
    public ResponseEntity<?> getMyGroups(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(groupService.getUserGroups(principal.getName()));
    }

    @PostMapping
    public ResponseEntity<?> createGroup(@RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String name = payload.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El nombre del grupo es obligatorio"));
        }
        BetGroup group = groupService.createGroup(name.trim(), principal.getName());
        return ResponseEntity.ok(group);
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
            return ResponseEntity.ok(group.get());
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
            
            org.springframework.cache.Cache cache = cacheManager.getCache("leaderboard");
            if (cache != null) cache.clear();
            sseService.broadcastUpdate("DATA_UPDATED");

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
            
            org.springframework.cache.Cache cache = cacheManager.getCache("leaderboard");
            if (cache != null) cache.clear();
            sseService.broadcastUpdate("DATA_UPDATED");

            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
