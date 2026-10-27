package com.porra.mundial.scoring;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MatchScoringCalculatorTest {

    private MatchScoringCalculator calculator;
    private ScoringRuleSet rules;

    @BeforeEach
    void setUp() {
        calculator = new MatchScoringCalculator();
        rules = ScoringRuleSet.builder()
                .exactScorePoints(3)
                .correctSignPoints(1)
                .goalDiffBonusPoints(1)
                .build();
    }

    @Test
    @DisplayName("Acierto exacto del resultado otorga los puntos configurados")
    void testExactScore() {
        MatchScoreResult res = calculator.calculate(2, 1, 2, 1, rules);

        assertEquals(3, res.totalPoints());
        assertTrue(res.exactScore());
        assertTrue(res.correctSign());
        assertTrue(res.correctGoalDiff());
        assertTrue(res.explanation().contains("Resultado exacto 2-1"));
    }

    @Test
    @DisplayName("Acierto de signo con misma diferencia de goles otorga bonus")
    void testSignWithGoalDifferenceBonus() {
        // Predijo 3-1 (+2), resultado real 2-0 (+2)
        MatchScoreResult res = calculator.calculate(3, 1, 2, 0, rules);

        assertEquals(2, res.totalPoints()); // 1 base + 1 bonus
        assertFalse(res.exactScore());
        assertTrue(res.correctSign());
        assertTrue(res.correctGoalDiff());
        assertTrue(res.explanation().contains("diferencia de goles"));
    }

    @Test
    @DisplayName("Acierto de signo simple otorga solo puntos de signo")
    void testSimpleCorrectSign() {
        // Predijo 1-0 (+1), resultado real 3-0 (+3)
        MatchScoreResult res = calculator.calculate(1, 0, 3, 0, rules);

        assertEquals(1, res.totalPoints());
        assertFalse(res.exactScore());
        assertTrue(res.correctSign());
        assertFalse(res.correctGoalDiff());
        assertTrue(res.explanation().contains("Acierto de signo 1X2 (1 pts)"));
    }

    @Test
    @DisplayName("Empate exacto otorga puntos de resultado exacto")
    void testExactDraw() {
        MatchScoreResult res = calculator.calculate(1, 1, 1, 1, rules);

        assertEquals(3, res.totalPoints());
        assertTrue(res.exactScore());
        assertTrue(res.correctSign());
    }

    @Test
    @DisplayName("Empate acertado con distinto marcador otorga puntos de signo")
    void testNonExactDraw() {
        MatchScoreResult res = calculator.calculate(0, 0, 2, 2, rules);

        assertEquals(1, res.totalPoints());
        assertFalse(res.exactScore());
        assertTrue(res.correctSign());
    }

    @Test
    @DisplayName("Fallo en signo y resultado otorga 0 puntos con explicacion")
    void testIncorrectOutcome() {
        // Predijo victoria local (2-1), gano el visitante (0-1)
        MatchScoreResult res = calculator.calculate(2, 1, 0, 1, rules);

        assertEquals(0, res.totalPoints());
        assertFalse(res.exactScore());
        assertFalse(res.correctSign());
        assertFalse(res.correctGoalDiff());
        assertTrue(res.explanation().contains("Sin acierto"));
    }

    @Test
    @DisplayName("Datos nulos o incompletos devuelven 0 puntos")
    void testNullInputs() {
        MatchScoreResult res = calculator.calculate(null, 1, 2, 1, rules);

        assertEquals(0, res.totalPoints());
        assertTrue(res.explanation().contains("incompleto"));
    }
}
