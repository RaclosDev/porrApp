package com.porra.mundial.scoring;

/**
 * Resultado detallado del calculo de puntos para un pronostico de partido.
 */
public record MatchScoreResult(
        int totalPoints,
        boolean exactScore,
        boolean correctSign,
        boolean correctGoalDiff,
        String explanation
) {
    public static MatchScoreResult zero(String explanation) {
        return new MatchScoreResult(0, false, false, false, explanation);
    }
}
