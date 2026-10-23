package com.porra.mundial.scoring;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ScoringRuleSetTest {

    @Test
    @DisplayName("Los valores por defecto corresponden al reglamento oficial del Mundial 2026")
    void testDefaultValues() {
        ScoringRuleSet rules = ScoringRuleSet.defaultWorldCup2026();

        assertEquals(10, rules.getGroupQualifierPoints());
        assertEquals(10, rules.getGroupExactPositionPoints());
        assertEquals(25, rules.getRoundOf32Points());
        assertEquals(30, rules.getRoundOf16Points());
        assertEquals(40, rules.getQuarterFinalPoints());
        assertEquals(60, rules.getSemiFinalPoints());
        assertEquals(200, rules.getChampionPoints());
        assertEquals(150, rules.getRunnerUpPoints());
        assertEquals(100, rules.getThirdPlacePoints());
        assertEquals(75, rules.getFourthPlacePoints());
        assertEquals(100, rules.getTopScorerPoints());
        assertEquals(3, rules.getExactScorePoints());
        assertEquals(1, rules.getCorrectSignPoints());
        assertEquals(1, rules.getGoalDiffBonusPoints());
    }

    @Test
    @DisplayName("Serializacion y deserializacion JSON preserva configuracion")
    void testJsonRoundtrip() {
        ScoringRuleSet original = ScoringRuleSet.builder()
                .groupQualifierPoints(15)
                .championPoints(250)
                .exactScorePoints(5)
                .build();

        String json = original.toJson();
        assertNotNull(json);
        assertTrue(json.contains("\"groupQualifierPoints\":15"));
        assertTrue(json.contains("\"championPoints\":250"));

        ScoringRuleSet restored = ScoringRuleSet.fromJson(json);
        assertEquals(15, restored.getGroupQualifierPoints());
        assertEquals(250, restored.getChampionPoints());
        assertEquals(5, restored.getExactScorePoints());
        // Defaults preservados
        assertEquals(30, restored.getRoundOf16Points());
    }

    @Test
    @DisplayName("JSON nulo o invalido devuelve los valores por defecto sin excepcion")
    void testInvalidJsonFallback() {
        ScoringRuleSet fromNull = ScoringRuleSet.fromJson(null);
        assertNotNull(fromNull);
        assertEquals(200, fromNull.getChampionPoints());

        ScoringRuleSet fromInvalid = ScoringRuleSet.fromJson("{not valid json}");
        assertNotNull(fromInvalid);
        assertEquals(200, fromInvalid.getChampionPoints());
    }
}
