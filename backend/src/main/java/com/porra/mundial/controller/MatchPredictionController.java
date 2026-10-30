package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayFriendPredictionDTO;
import com.porra.mundial.dto.MatchdaySubmissionDTO;
import com.porra.mundial.service.MatchPredictionService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Controlador REST para pronósticos por jornada y partido a partido (1X2 y marcador).
 */
@RestController
@RequestMapping("/api/predictions/matchday")
@RequiredArgsConstructor
public class MatchPredictionController {

    private final MatchPredictionService matchPredictionService;
    private final WebSocketService webSocketService;

    private String getRequesterEmail(Principal principal) {
        if (principal != null && principal.getName() != null) {
            return principal.getName();
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null) ? auth.getName() : null;
    }

    /**
     * Obtiene el listado de partidos y los pronósticos del usuario con detalle de bloqueo y puntos.
     */
    @GetMapping
    public ResponseEntity<List<MatchdayFixturePredictionDTO>> getMatchdayFixtures(
            @RequestParam Long groupId,
            @RequestParam(required = false) String round,
            Principal principal) {

        String email = getRequesterEmail(principal);
        List<MatchdayFixturePredictionDTO> fixtures = matchPredictionService.getMatchdayFixtures(email, groupId, round);
        return ResponseEntity.ok(fixtures);
    }

    /**
     * Guarda o actualiza los pronósticos de una lista de partidos comprobando los plazos individuales.
     */
    @PostMapping
    public ResponseEntity<?> submitMatchdayPredictions(
            @Valid @RequestBody MatchdaySubmissionDTO submission,
            Principal principal) {

        String email = getRequesterEmail(principal);
        if (email == null || "anonymousUser".equalsIgnoreCase(email)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Debes iniciar sesión para enviar tus pronósticos."));
        }

        int saved = matchPredictionService.saveMatchdayPredictions(email, submission.getGroupId(), submission.getPredictions());
        webSocketService.invalidateAndNotify();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "saved", saved,
                "message", "Pronósticos guardados correctamente (" + saved + " partidos)"
        ));
    }

    /**
     * Obtiene los pronósticos de todos los miembros del grupo para un partido específico.
     * Solo revela resultados de otros usuarios si el partido ya ha comenzado o finalizado.
     */
    @GetMapping("/matches/{matchId}/predictions")
    public ResponseEntity<List<MatchdayFriendPredictionDTO>> getMatchdayFriendPredictions(
            @PathVariable Long matchId,
            @RequestParam Long groupId,
            Principal principal) {

        String email = getRequesterEmail(principal);
        List<MatchdayFriendPredictionDTO> predictions = matchPredictionService.getFriendPredictionsForMatch(email, groupId, matchId);
        return ResponseEntity.ok(predictions);
    }
}
