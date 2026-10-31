package com.porra.mundial.scoring;

import com.porra.mundial.model.Edition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ScoringRuleSetTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

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
        assertEquals(200, rules.getTopScorerPoints());
        assertEquals(5, rules.getExactScorePoints());
        assertEquals(3, rules.getCorrectSignPoints());
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

    @Test
    @DisplayName("Las reglas que faltan en el JSON guardado toman su valor por defecto")
    void partialJsonKeepsTheDefaults() {
        ScoringRuleSet rules = ScoringRuleSet.fromJson("{\"championPoints\":300,\"unknownRule\":7}");

        assertEquals(300, rules.getChampionPoints());
        assertEquals(ScoringRuleSet.builder().championPoints(300).build(), rules);
    }

    @Test
    @DisplayName("Una edición sin reglas guardadas puntúa con las de por defecto")
    void editionWithoutRulesUsesTheDefaults() {
        ScoringRuleSet defaults = ScoringRuleSet.defaultWorldCup2026();

        assertEquals(defaults, ScoringRuleSet.forEdition(null));
        assertEquals(defaults, ScoringRuleSet.forEdition(Edition.builder().build()));
        assertEquals(40, ScoringRuleSet.forEdition(Edition.builder()
                .scoringRulesJson(ScoringRuleSet.builder().roundOf32Points(40).build().toJson()).build()).getRoundOf32Points());
    }

    @Test
    @DisplayName("asMap lista las catorce reglas con su nombre del JSON")
    void asMapListsEveryRule() {
        Map<String, Integer> rules = ScoringRuleSet.defaultWorldCup2026().asMap();

        assertEquals(14, rules.size());
        assertEquals(200, rules.get("championPoints"));
        assertEquals(1, rules.get("goalDiffBonusPoints"));
    }

    @Test
    @DisplayName("Se admiten de 0 a 1000 puntos por regla")
    void validateAcceptsTheWholeRange() {
        assertDoesNotThrow(() -> ScoringRuleSet.defaultWorldCup2026().validate());
        assertDoesNotThrow(() -> ScoringRuleSet.builder().championPoints(0).topScorerPoints(ScoringRuleSet.MAX_POINTS)
                .build().validate());
    }

    @Test
    @DisplayName("Una regla negativa o por encima del máximo no es válida")
    void validateRejectsOutOfRangeValues() {
        IllegalArgumentException negative = assertThrows(IllegalArgumentException.class,
                () -> ScoringRuleSet.builder().correctSignPoints(-1).build().validate());
        assertTrue(negative.getMessage().contains("correctSignPoints"), negative.getMessage());

        IllegalArgumentException tooHigh = assertThrows(IllegalArgumentException.class,
                () -> ScoringRuleSet.builder().championPoints(ScoringRuleSet.MAX_POINTS + 1).build().validate());
        assertTrue(tooHigh.getMessage().contains("championPoints"), tooHigh.getMessage());
    }

    @Test
    @DisplayName("fromRequest lee las reglas enviadas y completa las que faltan con las de por defecto")
    void fromRequestReadsAPartialBody() {
        ScoringRuleSet rules = ScoringRuleSet.fromRequest(MAPPER.readTree("{\"exactScorePoints\":7,\"otra\":\"x\"}"));

        assertEquals(ScoringRuleSet.builder().exactScorePoints(7).build(), rules);
    }

    @Test
    @DisplayName("fromRequest solo admite números enteros dentro del rango")
    void fromRequestRejectsInvalidValues() {
        for (String body : new String[]{"{\"exactScorePoints\":2.5}", "{\"exactScorePoints\":\"5\"}",
                "{\"exactScorePoints\":null}", "{\"exactScorePoints\":-1}", "{\"exactScorePoints\":1001}",
                "{\"exactScorePoints\":3000000000}", "[1,2]"}) {
            IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                    () -> ScoringRuleSet.fromRequest(MAPPER.readTree(body)), body);
            assertFalse(error.getMessage().isBlank(), body);
        }
        assertThrows(IllegalArgumentException.class, () -> ScoringRuleSet.fromRequest(null));
    }
    @Test
    void disabledPichichiChangesEffectivePointsButPreservesConfiguredRules() {
        ScoringRuleSet configured = ScoringRuleSet.defaultWorldCup2026();
        configured.setTopScorerPoints(73);
        Edition edition = Edition.builder().pichichi(false).scoringRulesJson(configured.toJson()).build();
        assertEquals(0, ScoringRuleSet.effectiveForEdition(edition).getTopScorerPoints());
        assertEquals(73, ScoringRuleSet.forEdition(edition).getTopScorerPoints());
        edition.setPichichi(true);
        assertEquals(73, ScoringRuleSet.effectiveForEdition(edition).getTopScorerPoints());
    }

}
