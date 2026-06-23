package com.porra.mundial.controller;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserAccountRepository userAccountRepository;

    @PutMapping("/me/preferences")
    public ResponseEntity<?> updatePreferences(@RequestBody Map<String, Object> payload, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Optional<UserAccount> userOpt = userAccountRepository.findByParticipantNameIgnoreCase(principal.getName());
        if (userOpt.isPresent()) {
            UserAccount user = userOpt.get();
            if (payload.containsKey("lastSelectedGroupId")) {
                Number groupId = (Number) payload.get("lastSelectedGroupId");
                user.setLastSelectedGroupId(groupId != null ? groupId.longValue() : null);
                userAccountRepository.save(user);
            }
            return ResponseEntity.ok(Map.of("status", "success"));
        }
        return ResponseEntity.notFound().build();
    }
    
    @GetMapping("/me")
    public ResponseEntity<?> getMe(Principal principal) {
         if (principal == null) return ResponseEntity.status(401).build();
         Optional<UserAccount> userOpt = userAccountRepository.findByParticipantNameIgnoreCase(principal.getName());
         if (userOpt.isPresent()) {
              UserAccount user = userOpt.get();
              return ResponseEntity.ok(Map.of(
                  "participantName", user.getParticipantName(),
                  "lastSelectedGroupId", user.getLastSelectedGroupId()
              ));
         }
         return ResponseEntity.notFound().build();
    }
}
