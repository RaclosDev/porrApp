package com.porra.mundial.controller;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.service.LeaderboardService;
import com.porra.mundial.service.PredictionService;
import com.porra.mundial.service.StandingsService;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * Controlador de Clasificaciones Oficiales, Cuadro Oficial y Exportacion.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StandingsController {

    private final StandingsService standingsService;
    private final SyncService syncService;
    private final PredictionRepository predictionRepository;
    private final PredictionService predictionService;
    private final LeaderboardService leaderboardService;
    private final com.porra.mundial.service.GroupService groupService;

    @GetMapping("/standings")
    public Map<String, Map<String, Map<String, Integer>>> getStandings() {
        return standingsService.getOfficialPoints();
    }

    @GetMapping("/standings/official-bracket")
    public ResponseEntity<?> getOfficialBracket() {
        Optional<Prediction> officialPrediction = predictionRepository.findByIsOfficialTrue()
                .or(() -> predictionRepository.findByName("official"));

        if (officialPrediction.isPresent()) {
            try {
                PredictionDataDTO dto = predictionService.getPredictionData(officialPrediction.get().getId());
                syncService.enrichPredictionDataWithMatches(dto);
                return ResponseEntity.ok(dto);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Error construyendo el cuadro oficial"));
            }
        }

        PredictionDataDTO fallbackDto = new PredictionDataDTO();
        syncService.enrichPredictionDataWithMatches(fallbackDto);
        return ResponseEntity.ok(fallbackDto);
    }
}
