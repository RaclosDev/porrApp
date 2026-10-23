package com.porra.mundial.scoring;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Parametrizacion versionada de reglas de puntuacion para torneos y porras.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScoringRuleSet {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Fase de grupos
    @Builder.Default
    private int groupQualifierPoints = 10;
    @Builder.Default
    private int groupExactPositionPoints = 10;

    // Rondas eliminatorias
    @Builder.Default
    private int roundOf32Points = 25;
    @Builder.Default
    private int roundOf16Points = 30;
    @Builder.Default
    private int quarterFinalPoints = 40;
    @Builder.Default
    private int semiFinalPoints = 60;
    @Builder.Default
    private int championPoints = 200;
    @Builder.Default
    private int runnerUpPoints = 150;
    @Builder.Default
    private int thirdPlacePoints = 100;
    @Builder.Default
    private int fourthPlacePoints = 75;

    // Goleador / Pichichi
    @Builder.Default
    private int topScorerPoints = 0;

    // Puntuacion de partidos directos (1X2 y marcador exacto)
    @Builder.Default
    private int exactScorePoints = 3;
    @Builder.Default
    private int correctSignPoints = 1;
    @Builder.Default
    private int goalDiffBonusPoints = 1;

    public static ScoringRuleSet defaultWorldCup2026() {
        return ScoringRuleSet.builder().build();
    }

    public static ScoringRuleSet fromJson(String json) {
        if (json == null || json.isBlank()) {
            return defaultWorldCup2026();
        }
        try {
            return MAPPER.readValue(json, ScoringRuleSet.class);
        } catch (Exception e) {
            return defaultWorldCup2026();
        }
    }

    public String toJson() {
        try {
            return MAPPER.writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }
}
