package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayFriendPredictionDTO;
import com.porra.mundial.dto.MatchdaySubmissionDTO;
import com.porra.mundial.dto.MatchdaySubmissionResponse;
import com.porra.mundial.model.League;
import com.porra.mundial.service.MatchPredictionService;
import com.porra.mundial.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * Pronósticos por jornada, partido a partido (signo 1X2 y marcador).
 * Enviar pronósticos exige sesión (ver {@code SecurityConfig}).
 */
@RestController
@RequestMapping("/api/predictions/matchday")
@RequiredArgsConstructor
public class MatchPredictionController {

    private final MatchPredictionService matchPredictionService;
    private final WebSocketService webSocketService;

    /** Partidos de la jornada con el pronóstico del usuario, su bloqueo y los puntos obtenidos. */
    @GetMapping
    public List<MatchdayFixturePredictionDTO> getMatchdayFixtures(@RequestParam Long groupId,
                                                                  @RequestParam(required = false) String round,
                                                                  Principal principal) {
        return matchPredictionService.getMatchdayFixtures(CurrentUser.email(principal), groupId, round);
    }

    /** Guarda los pronósticos de varios partidos respetando el cierre de cada uno. */
    @PostMapping
    public MatchdaySubmissionResponse submitMatchdayPredictions(@Valid @RequestBody MatchdaySubmissionDTO submission,
                                                                Principal principal) {
        int saved = matchPredictionService.saveMatchdayPredictions(
                CurrentUser.email(principal), submission.getGroupId(), submission.getPredictions());
        webSocketService.notifyLeagueChanged(submission.getGroupId() != null ? submission.getGroupId() : League.GLOBAL_ID);
        return MatchdaySubmissionResponse.of(saved);
    }

    /**
     * Pronósticos de los miembros de la liga para un partido.
     * Los de otros usuarios solo se revelan cuando el partido ha empezado.
     */
    @GetMapping("/matches/{matchId}/predictions")
    public List<MatchdayFriendPredictionDTO> getMatchdayFriendPredictions(@PathVariable Long matchId,
                                                                          @RequestParam Long groupId,
                                                                          Principal principal) {
        return matchPredictionService.getFriendPredictionsForMatch(CurrentUser.email(principal), groupId, matchId);
    }
}
