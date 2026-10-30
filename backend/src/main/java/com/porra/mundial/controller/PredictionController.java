package com.porra.mundial.controller;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.dto.PredictionSavedResponse;
import com.porra.mundial.dto.StatusResponse;
import com.porra.mundial.model.League;
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
 * Pronósticos de cuadro completo (Mundial). Las lecturas son públicas para la Porra Global;
 * las de ligas privadas y todas las escrituras exigen pertenecer a la liga.
 */
@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final GroupService groupService;
    private final WebSocketService webSocketService;
    private final LeaderboardService leaderboardService;

    /** Pronósticos de una liga (por defecto, la Porra Global). */
    @GetMapping
    @Transactional(readOnly = true)
    public List<PredictionResponseDTO> getAllPredictions(@RequestParam(required = false) Long groupId, Principal principal) {
        String email = CurrentUser.email(principal);
        Long targetGroupId = groupId != null ? groupId : League.GLOBAL_ID;
        groupService.assertCanView(targetGroupId, email);
        return predictionService.toPredictionDtoList(predictionService.getPredictionsByGroupId(targetGroupId), email);
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
                                                    @RequestParam(required = false) Long groupId,
                                                    Principal principal) {
        String email = CurrentUser.email(principal);
        Long effectiveGroupId = groupId != null ? groupId : League.GLOBAL_ID;
        groupService.assertCanView(effectiveGroupId, email);

        String name = body.getPrediction() != null ? body.getPrediction() : body.getUser();
        Prediction prediction = predictionService.createPrediction(email, name, body, effectiveGroupId);
        webSocketService.notifyLeagueChanged(effectiveGroupId);
        return PredictionSavedResponse.created(prediction.getId(), prediction.getParticipantName(), prediction.getGroupId());
    }

    @PutMapping("/{id}")
    public PredictionSavedResponse updatePrediction(@PathVariable Long id, @Valid @RequestBody PredictionDataDTO body,
                                                    Principal principal) {
        Prediction prediction = predictionService.updatePrediction(id, CurrentUser.email(principal), body.getUser(), body.getPrediction(), body);
        return PredictionSavedResponse.updated(prediction.getId());
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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pronóstico no encontrado");
        }
        return score;
    }

    /** Marca un pronóstico como pagado. Solo el administrador de su liga. */
    @PutMapping("/{id}/pay")
    public StatusResponse markAsPaid(@PathVariable Long id, Principal principal) {
        predictionService.markAsPaid(id, CurrentUser.email(principal));
        return new StatusResponse("paid", null);
    }

    @DeleteMapping("/{id}")
    public StatusResponse deletePrediction(@PathVariable Long id, Principal principal) {
        predictionService.deletePrediction(id, CurrentUser.email(principal));
        return new StatusResponse("deleted", null);
    }
}
