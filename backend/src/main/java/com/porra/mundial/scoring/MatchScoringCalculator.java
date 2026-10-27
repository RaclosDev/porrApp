package com.porra.mundial.scoring;

import org.springframework.stereotype.Component;

/**
 * Calculador determinista de puntuacion para predicciones de partidos directos (1X2 y marcador).
 */
@Component
public class MatchScoringCalculator {

    public MatchScoreResult calculateSign(String sign, Integer actualHome, Integer actualAway, ScoringRuleSet rules) {
        if (actualHome == null || actualAway == null || sign == null) {
            return MatchScoreResult.zero("Resultado o pronostico incompleto");
        }
        String actualSign = actualHome > actualAway ? "1" : actualHome.equals(actualAway) ? "X" : "2";
        if (!actualSign.equals(sign)) {
            return MatchScoreResult.zero("Sin acierto en signo (0 pts)");
        }
        int points = (rules != null ? rules : ScoringRuleSet.defaultWorldCup2026()).getCorrectSignPoints();
        return new MatchScoreResult(points, false, true, false, "Acierto de signo 1X2 (" + points + " pts)");
    }

    public MatchScoreResult calculate(Integer predHome, Integer predAway, Integer actualHome, Integer actualAway, ScoringRuleSet rules) {
        if (rules == null) {
            rules = ScoringRuleSet.defaultWorldCup2026();
        }

        if (predHome == null || predAway == null || actualHome == null || actualAway == null) {
            return MatchScoreResult.zero("Resultado o pronostico incompleto");
        }

        if (predHome.equals(actualHome) && predAway.equals(actualAway)) {
            int pts = rules.getExactScorePoints();
            return new MatchScoreResult(
                    pts,
                    true,
                    true,
                    true,
                    String.format("Resultado exacto %d-%d (%d pts)", actualHome, actualAway, pts)
            );
        }

        int predSign = Integer.compare(predHome, predAway);
        int actualSign = Integer.compare(actualHome, actualAway);

        if (predSign == actualSign) {
            boolean sameGoalDiff = (predHome - predAway) == (actualHome - actualAway);
            if (predSign != 0 && sameGoalDiff && rules.getGoalDiffBonusPoints() > 0) {
                int pts = rules.getCorrectSignPoints() + rules.getGoalDiffBonusPoints();
                return new MatchScoreResult(
                        pts,
                        false,
                        true,
                        true,
                        String.format("Acierto de signo 1X2 con diferencia de goles correcta (%d pts)", pts)
                );
            }

            int pts = rules.getCorrectSignPoints();
            return new MatchScoreResult(
                    pts,
                    false,
                    true,
                    sameGoalDiff,
                    String.format("Acierto de signo 1X2 (%d pts)", pts)
            );
        }

        return MatchScoreResult.zero("Sin acierto en resultado ni signo (0 pts)");
    }
}
