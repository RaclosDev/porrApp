package com.porra.mundial.controller;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.BetResponseDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Controlador REST para la gestion de Pronosticos y Porras (Prediction).
 * Expone rutas bajo /api/predictions y /api/bets para total compatibilidad.
 */
@RestController
@RequestMapping({"/api/predictions", "/api/bets"})
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final WebSocketService webSocketService;

    private String getRequesterEmail(Principal principal) {
        if (principal != null && principal.getName() != null) {
            return principal.getName();
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null) ? auth.getName() : null;
    }

    @GetMapping
    @Cacheable(value = "allBetsDto", key = "#groupId != null ? #groupId : 'ALL'")
    public List<BetResponseDTO> getAllBets(@RequestParam(required = false) Long groupId, Principal principal) {
        String email = getRequesterEmail(principal);
        List<Prediction> predictions;

        if (groupId != null) {
            predictions = predictionService.getPredictionsByGroupId(groupId);
        } else {
            if (predictionService.isSuperAdmin(email)) {
                predictions = predictionService.getAllPredictions();
            } else {
                predictions = predictionService.getPredictionsByGroupId(1L);
            }
        }

        return predictionService.toBetDtoList(predictions, email);
    }

    @GetMapping("/mine")
    @Cacheable(value = "myBetsDto", key = "T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName()")
    public List<BetResponseDTO> getMyBets(Principal principal) {
        String email = getRequesterEmail(principal);
        return predictionService.toBetDtoList(predictionService.getPredictionsByGoogleEmail(email), email);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createBet(@Valid @RequestBody BetDataDTO body,
                                                         @RequestParam(required = false) Long groupId,
                                                         Principal principal) {
        String email = getRequesterEmail(principal);
        String betName = body.getBet();

        Prediction prediction = predictionService.createPrediction(email, betName != null ? betName : body.getUser(), body, groupId);
        webSocketService.invalidateAndNotify();

        return ResponseEntity.ok(Map.of(
                "id", prediction.getId(),
                "participantName", prediction.getParticipantName() != null ? prediction.getParticipantName() : "",
                "groupId", prediction.getGroupId() != null ? prediction.getGroupId().toString() : "",
                "status", "creada_con_exito"
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateBet(@PathVariable Long id,
                                       @Valid @RequestBody BetDataDTO body,
                                       Principal principal) {
        String email = getRequesterEmail(principal);
        Prediction prediction = predictionService.updatePrediction(id, email, body.getUser(), body.getBet(), body);

        return ResponseEntity.ok(Map.of("id", prediction.getId(), "status", "actualizada_con_exito"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getBet(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        BetDataDTO dto = predictionService.getBetData(id, email);
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/{id}/pay")
    public ResponseEntity<?> markAsPaid(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        predictionService.markAsPaid(id, email);
        return ResponseEntity.ok(Map.of("status", "paid"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBet(@PathVariable Long id, Principal principal) {
        String email = getRequesterEmail(principal);
        predictionService.deletePrediction(id, email);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }
}
