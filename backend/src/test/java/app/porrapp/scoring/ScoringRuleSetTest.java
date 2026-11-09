package app.porrapp.scoring;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.Edition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ScoringRuleSetTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Reglas guardadas de una liga creada con los valores del Mundial 2026, antes de los generales. */
    private static final String WORLD_CUP_RULES_JSON = """
            {"groupQualifierPoints":10,"groupExactPositionPoints":10,"roundOf32Points":25,"roundOf16Points":30,
            "quarterFinalPoints":40,"semiFinalPoints":60,"championPoints":200,"runnerUpPoints":150,
            "thirdPlacePoints":100,"fourthPlacePoints":75,"topScorerPoints":200,"exactScorePoints":5,
            "correctSignPoints":3,"goalDiffBonusPoints":1}""";

    @Test
    @DisplayName("Una liga nueva nace con valores generales, no con los del Mundial 2026")
    void testDefaultValues() {
        Map<String, Integer> expected = new java.util.LinkedHashMap<>();
        expected.put("groupQualifierPoints", 5);
        expected.put("groupExactPositionPoints", 5);
        expected.put("roundOf32Points", 10);
        expected.put("roundOf16Points", 15);
        expected.put("quarterFinalPoints", 20);
        expected.put("semiFinalPoints", 30);
        expected.put("championPoints", 50);
        expected.put("runnerUpPoints", 30);
        expected.put("thirdPlacePoints", 20);
        expected.put("fourthPlacePoints", 10);
        expected.put("topScorerPoints", 30);
        expected.put("exactScorePoints", 5);
        expected.put("correctSignPoints", 3);
        expected.put("goalDiffBonusPoints", 1);
        expected.put("survivorRoundPoints", 1);
        expected.put("survivorLives", 1);
        expected.put("survivorDrawSurvives", 0);
        expected.put("f1ExactPositionPoints", 10);
        expected.put("f1PodiumPoints", 4);
        expected.put("f1PolePoints", 5);
        expected.put("f1FastestLapPoints", 3);
        expected.put("nbaPlayInPoints", 5);
        expected.put("nbaFirstRoundPoints", 10);
        expected.put("nbaConferenceSemifinalPoints", 20);
        expected.put("nbaConferenceFinalPoints", 30);
        expected.put("nbaFinalsPoints", 50);
        expected.put("nbaFirstRoundExactPoints", 5);
        expected.put("nbaConferenceSemifinalExactPoints", 10);
        expected.put("nbaConferenceFinalExactPoints", 15);
        expected.put("nbaFinalsExactPoints", 25);
        expected.put("fightWinnerPoints", 3);
        expected.put("fightMethodPoints", 2);
        expected.put("fightRoundPoints", 2);

        assertEquals(expected, ScoringRuleSet.defaults().asMap());
    }

    @Test
    @DisplayName("En el cuadro cada ronda vale más que la anterior y el campeón es el acierto que más vale")
    void bracketDefaultsGrowRoundByRound() {
        ScoringRuleSet rules = ScoringRuleSet.defaults();

        int[] ladder = {rules.getGroupQualifierPoints(), rules.getRoundOf32Points(), rules.getRoundOf16Points(),
                rules.getQuarterFinalPoints(), rules.getSemiFinalPoints(), rules.getChampionPoints()};
        for (int i = 1; i < ladder.length; i++) {
            assertTrue(ladder[i] > ladder[i - 1], "ronda " + i);
        }
        assertTrue(rules.getChampionPoints() > rules.getRunnerUpPoints());
        assertTrue(rules.getRunnerUpPoints() > rules.getThirdPlacePoints());
        assertTrue(rules.getThirdPlacePoints() > rules.getFourthPlacePoints());
        assertTrue(rules.getTopScorerPoints() <= rules.getChampionPoints());
    }

    @Test
    @DisplayName("El tenis conserva su puntuación propia")
    void tennisDefaultsAreUnchanged() {
        ScoringRuleSet tennis = ScoringRuleSet.defaultTennis();

        assertEquals(10, tennis.getRoundOf16Points());
        assertEquals(15, tennis.getQuarterFinalPoints());
        assertEquals(20, tennis.getSemiFinalPoints());
        assertEquals(30, tennis.getChampionPoints());
        assertEquals(5, tennis.getExactScorePoints());
    }

    @Test
    @DisplayName("Una liga existente conserva las reglas que tiene guardadas")
    void storedRulesAreKeptAsTheyAre() {
        ScoringRuleSet stored = ScoringRuleSet.fromJson(WORLD_CUP_RULES_JSON);

        assertEquals(10, stored.getGroupQualifierPoints());
        assertEquals(10, stored.getGroupExactPositionPoints());
        assertEquals(25, stored.getRoundOf32Points());
        assertEquals(30, stored.getRoundOf16Points());
        assertEquals(40, stored.getQuarterFinalPoints());
        assertEquals(60, stored.getSemiFinalPoints());
        assertEquals(200, stored.getChampionPoints());
        assertEquals(150, stored.getRunnerUpPoints());
        assertEquals(100, stored.getThirdPlacePoints());
        assertEquals(75, stored.getFourthPlacePoints());
        assertEquals(200, stored.getTopScorerPoints());
        assertEquals(stored, ScoringRuleSet.forEdition(
                Edition.builder().scoringRulesJson(WORLD_CUP_RULES_JSON).build()));
        // Leerlas y volver a guardarlas no las cambia.
        assertEquals(stored, ScoringRuleSet.fromJson(stored.toJson()));
    }

    @Test
    @DisplayName("Una liga anterior sin reglas guardadas sigue puntuando con las que tenía")
    void editionWithoutStoredRulesKeepsItsOldValues() {
        ScoringRuleSet stored = ScoringRuleSet.fromJson(WORLD_CUP_RULES_JSON);

        assertEquals(stored, ScoringRuleSet.forEdition(Edition.builder().build()));
        assertEquals(stored, ScoringRuleSet.fromJson(" "));
        assertEquals(stored, ScoringRuleSet.fromJson("{}"));
        // Solo guardó lo que cambió: el resto son sus valores de entonces, no los generales.
        ScoringRuleSet partial = ScoringRuleSet.fromJson("{\"championPoints\":300}");
        assertEquals(300, partial.getChampionPoints());
        assertEquals(150, partial.getRunnerUpPoints());
        assertEquals(25, partial.getRoundOf32Points());
    }

    @Test
    @DisplayName("Una liga nueva guarda todas sus reglas, así que se leen tal cual")
    void newLeagueRulesRoundTrip() {
        ScoringRuleSet defaults = ScoringRuleSet.defaults();

        assertEquals(defaults, ScoringRuleSet.fromJson(defaults.toJson()));
        assertEquals(ScoringRuleSet.defaultTennis(),
                ScoringRuleSet.fromJson(ScoringRuleSet.defaultTennis().toJson()));
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
        assertEquals(original, restored);
    }

    @Test
    @DisplayName("JSON nulo o invalido devuelve los valores de las ligas anteriores sin excepcion")
    void testInvalidJsonFallback() {
        ScoringRuleSet fromNull = ScoringRuleSet.fromJson(null);
        assertNotNull(fromNull);
        assertEquals(200, fromNull.getChampionPoints());

        ScoringRuleSet fromInvalid = ScoringRuleSet.fromJson("{not valid json}");
        assertNotNull(fromInvalid);
        assertEquals(200, fromInvalid.getChampionPoints());
    }

    @Test
    @DisplayName("Una regla desconocida en el JSON guardado se ignora")
    void unknownStoredRuleIsIgnored() {
        ScoringRuleSet rules = ScoringRuleSet.fromJson("{\"championPoints\":300,\"unknownRule\":7}");

        assertEquals(300, rules.getChampionPoints());
        assertEquals(3, rules.getCorrectSignPoints());
    }

    @Test
    @DisplayName("Sin edición se puntúa con las de por defecto, y con ella, con las suyas")
    void editionRulesAreItsStoredOnes() {
        assertEquals(ScoringRuleSet.defaults(), ScoringRuleSet.forEdition(null));
        assertEquals(40, ScoringRuleSet.forEdition(Edition.builder()
                .scoringRulesJson(ScoringRuleSet.builder().roundOf32Points(40).build().toJson()).build()).getRoundOf32Points());
    }

    @Test
    @DisplayName("asMap lista las diecisiete reglas con su nombre del JSON")
    void asMapListsEveryRule() {
        Map<String, Integer> rules = ScoringRuleSet.defaults().asMap();

        assertEquals(33, rules.size());
        assertEquals(3, rules.get("fightWinnerPoints"));
        assertEquals(10, rules.get("f1ExactPositionPoints"));
        assertEquals(50, rules.get("championPoints"));
        assertEquals(1, rules.get("goalDiffBonusPoints"));
        assertEquals(1, rules.get("survivorLives"));
        assertEquals(25, rules.get("nbaFinalsExactPoints"));
    }

    @Test
    @DisplayName("Se admiten de 0 a 1000 puntos por regla")
    void validateAcceptsTheWholeRange() {
        assertDoesNotThrow(() -> ScoringRuleSet.defaults().validate());
        assertDoesNotThrow(() -> ScoringRuleSet.builder().championPoints(0).topScorerPoints(ScoringRuleSet.MAX_POINTS)
                .build().validate());
    }

    @Test
    @DisplayName("Una regla negativa o por encima del máximo no es válida")
    void validateRejectsOutOfRangeValues() {
        BusinessException negative = assertThrows(BusinessException.class,
                () -> ScoringRuleSet.builder().correctSignPoints(-1).build().validate());
        assertTrue(negative.getMessage().contains("correctSignPoints"), negative.getMessage());

        BusinessException tooHigh = assertThrows(BusinessException.class,
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
            BusinessException error = assertThrows(BusinessException.class,
                    () -> ScoringRuleSet.fromRequest(MAPPER.readTree(body)), body);
            assertFalse(error.getMessage().isBlank(), body);
        }
        assertThrows(BusinessException.class, () -> ScoringRuleSet.fromRequest(null));
    }
    @Test
    void disabledPichichiChangesEffectivePointsButPreservesConfiguredRules() {
        ScoringRuleSet configured = ScoringRuleSet.defaults();
        configured.setTopScorerPoints(73);
        Edition edition = Edition.builder().pichichi(false).scoringRulesJson(configured.toJson()).build();
        assertEquals(0, ScoringRuleSet.effectiveForEdition(edition).getTopScorerPoints());
        assertEquals(73, ScoringRuleSet.forEdition(edition).getTopScorerPoints());
        edition.setPichichi(true);
        assertEquals(73, ScoringRuleSet.effectiveForEdition(edition).getTopScorerPoints());
    }

}
