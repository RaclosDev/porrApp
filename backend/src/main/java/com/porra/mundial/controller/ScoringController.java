package com.porra.mundial.controller;

import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controlador REST para consultar reglamentos de puntuacion y simular calculos explicables.
 */
@RestController
@RequestMapping("/api/rules")
@RequiredArgsConstructor
public class ScoringController {

    private final MatchScoringCalculator matchScoringCalculator;

    @GetMapping
    public ResponseEntity<ScoringRuleSet> getActiveRules() {
        return ResponseEntity.ok(ScoringRuleSet.defaultWorldCup2026());
    }

    @GetMapping("/preview")
    public ResponseEntity<MatchScoreResult> previewMatchScore(
            @RequestParam int predHome,
            @RequestParam int predAway,
            @RequestParam int actualHome,
            @RequestParam int actualAway
    ) {
        MatchScoreResult result = matchScoringCalculator.calculate(
                predHome, predAway, actualHome, actualAway, ScoringRuleSet.defaultWorldCup2026()
        );
        return ResponseEntity.ok(result);
    }
}
