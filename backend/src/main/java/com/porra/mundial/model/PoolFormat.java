package com.porra.mundial.model;

/**
 * Formato o modalidad de juego para una porra (PoolFormat).
 * Define qué partes del torneo pronostica cada participante.
 */
public enum PoolFormat {
    /** Pronóstico completo: fase de grupos y todo el árbol de eliminatorias. */
    FULL_BRACKET,
    /** Pronóstico parcial: solo eliminatorias (Octavos/Dieciseisavos en adelante). */
    KNOCKOUTS_ONLY,
    /** Jornada a jornada: 1X2 y marcador de cada partido. */
    MATCH_DAY;

    /** null o desconocido → FULL_BRACKET. */
    public static PoolFormat fromString(String val) {
        if (val == null || val.isBlank()) {
            return FULL_BRACKET;
        }
        for (PoolFormat format : values()) {
            if (format.name().equalsIgnoreCase(val.trim())) {
                return format;
            }
        }
        return FULL_BRACKET;
    }
}
