package app.porrapp.controller;

import app.porrapp.scoring.MatchScoreResult;
import app.porrapp.scoring.MatchScoringCalculator;
import app.porrapp.scoring.ScoringRuleSet;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Reglas de puntuación y vista previa de los puntos de un partido. */
@RestController
@RequestMapping("/api/rules")
@RequiredArgsConstructor
public class ScoringController {

    private final MatchScoringCalculator matchScoringCalculator;

    @GetMapping
    public ResponseEntity<ScoringRuleSet> getActiveRules() {
        return ResponseEntity.ok(ScoringRuleSet.defaults());
    }

    @GetMapping("/preview")
    public ResponseEntity<MatchScoreResult> previewMatchScore(
            @RequestParam int predHome,
            @RequestParam int predAway,
            @RequestParam int actualHome,
            @RequestParam int actualAway
    ) {
        MatchScoreResult result = matchScoringCalculator.calculate(
                predHome, predAway, actualHome, actualAway, ScoringRuleSet.defaults()
        );
        return ResponseEntity.ok(result);
    }
}
