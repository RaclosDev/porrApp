package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Controlador REST para la gestion de Pronosticos y Porras (Prediction).
 * Expone las rutas bajo /api/predictions.
 */
@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final com.porra.mundial.service.GroupService groupService;
    private final WebSocketService webSocketService;
    private final com.porra.mundial.service.LeaderboardService leaderboardService;

    private String getRequesterEmail(Principal principal) {
        if (principal != null && principal.getName() != null && !"anonymousUser".equalsIgnoreCase(principal.getName())) {
            return principal.getName();
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !"anonymousUser".equalsIgnoreCase(auth.getName())) {
            return auth.getName();
        }
        return null;
    }

    @GetMapping
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<PredictionResponseDTO> getAllPredictions(@RequestParam(required = false) Long groupId, Principal principal) {
        String email = getRequesterEmail(principal);
        Long targetGroupId = groupId != null ? groupId : 1L;

        if (!Long.valueOf(1L).equals(targetGroupId)) {
            if (email == null || !groupService.isUserMemberOrAdmin(targetGroupId, email)) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "No perteneces a esta liga privada");
            }
            return predictionService.toPredictionDtoList(predictionService.getPredictionsByGroupId(targetGroupId), email);
        } else {
            return predictionService.toPredictionDtoList(predictionService.getPredictionsByGroupId(1L), email);
        }
    }

    @GetMapping("/mine")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<PredictionResponseDTO> getMyPredictions(Principal principal) {
        String email = getRequesterEmail(principal);
        if (email == null) {
            return java.util.Collections.emptyList();
        }
        return predictionService.toPredictionDtoList(predictionService.getPredictionsByGoogleEmail(email), email);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createPrediction(@Valid @RequestBody PredictionDataDTO body,
                                                                 @RequestParam(required = false) Long groupId,
                                                                 Principal principal) {
        String email = getRequesterEmail(principal);
        Long effectiveGroupId = groupId != null ? groupId : 1L;
        if (!Long.valueOf(1L).equals(effectiveGroupId) && (email == null || !groupService.isUserMemberOrAdmin(effectiveGroupId, email))) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "No perteneces a esta liga privada");
        }
        String name = body.getPrediction() != null ? body.getPrediction() : body.getUser();

        Prediction prediction = predictionService.createPrediction(email, name, body, effectiveGroupId);
        webSocketService.invalidateAndNotify();

        return ResponseEntity.ok(Map.of(
                "id", prediction.getId(),
                "participantName", prediction.getParticipantName() != null ? prediction.getParticipantName() : "",
                "groupId", prediction.getGroupId() != null ? prediction.getGroupId().toString() : "",
                "status", "creada_con_exito"
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updatePrediction(@PathVariable Long id,
                                               @Valid @RequestBody PredictionDataDTO body,
                                               Principal principal) {
        String email = getRequesterEmail(principal);
        Prediction prediction = predictionService.updatePrediction(id, email, body.getUser(), body.getPrediction(), body);

        return ResponseEntity.ok(Map.of("id", prediction.getId(), "status", "actualizada_con_exito"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPrediction(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        PredictionDataDTO dto = predictionService.getPredictionData(id, email);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/{id}/score")
    public ResponseEntity<?> getPredictionScore(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        // Verify user can read prediction data first (access check)
        predictionService.getPredictionData(id, email);
        com.porra.mundial.dto.ParticipantScoreDTO score = leaderboardService.calculateScoreForPrediction(id);
        if (score == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(score);
    }

    @PutMapping("/{id}/pay")
    public ResponseEntity<?> markAsPaid(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        predictionService.markAsPaid(id, email);
        return ResponseEntity.ok(Map.of("status", "paid"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePrediction(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        predictionService.deletePrediction(id, email);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }
}
