package com.porra.mundial.dto;

/**
 * Resultado de guardar los pronósticos de una jornada.
 *
 * @param success siempre true si se guardó
 * @param saved   partidos guardados
 * @param message texto para el usuario
 */
public record MatchdaySubmissionResponse(boolean success, int saved, String message) {

    public static MatchdaySubmissionResponse of(int saved) {
        return new MatchdaySubmissionResponse(true, saved, "Pronósticos guardados correctamente (" + saved + " partidos)");
    }
}
