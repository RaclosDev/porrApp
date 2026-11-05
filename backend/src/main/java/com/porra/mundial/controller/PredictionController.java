package com.porra.mundial.controller;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.dto.PredictionSavedResponse;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.service.GroupService;
import com.porra.mundial.service.LeaderboardService;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

/**
 * Pronósticos de cuadro completo (Mundial). Las lecturas de una liga pública son públicas;
 * las de ligas privadas exigen pertenecer a la liga.
 */
@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final GroupService groupService;
    private final WebSocketService webSocketService;
    private final LeaderboardService leaderboardService;

    /** Pronósticos de una liga. */
    @GetMapping
    @Transactional(readOnly = true)
    public List<PredictionResponseDTO> getAllPredictions(@RequestParam Long groupId, Principal principal) {
        String email = CurrentUser.email(principal);
        groupService.assertCanView(groupId, email);
        return predictionService.toPredictionDtoList(predictionService.getPredictionsByGroupId(groupId), email);
    }

    /** Pronósticos del usuario autenticado en todas sus ligas. */
    @GetMapping("/mine")
    @Transactional(readOnly = true)
    public List<PredictionResponseDTO> getMyPredictions(Principal principal) {
        String email = CurrentUser.email(principal);
        return predictionService.toPredictionDtoList(predictionService.getPredictionsByGoogleEmail(email), email);
    }

    @PostMapping
    public PredictionSavedResponse createPrediction(@Valid @RequestBody PredictionDataDTO body,
                                                    @RequestParam Long groupId,
                                                    Principal principal) {
        String email = CurrentUser.email(principal);
        groupService.assertCanView(groupId, email);

        String name = body.getPrediction() != null ? body.getPrediction() : body.getUser();
        Prediction prediction = predictionService.createPrediction(email, name, body, groupId);
        webSocketService.notifyPredictionsChanged(groupId);
        return PredictionSavedResponse.created(prediction.getId(), prediction.getParticipantName(), prediction.getGroupId());
    }

    @GetMapping("/{id}")
    public PredictionDataDTO getPrediction(@PathVariable Long id, Principal principal) {
        return predictionService.getPredictionData(id, CurrentUser.email(principal));
    }

    /** Puntuación desglosada de un pronóstico frente al cuadro oficial. */
    @GetMapping("/{id}/score")
    public ParticipantScoreDTO getPredictionScore(@PathVariable Long id, Principal principal) {
        // getPredictionData comprueba que el usuario puede ver este pronóstico.
        predictionService.getPredictionData(id, CurrentUser.email(principal));
        ParticipantScoreDTO score = leaderboardService.calculateScoreForPrediction(id);
        if (score == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Predicción no encontrada");
        }
        return score;
    }
}
