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
    /** Pronóstico jornada a jornada: predicciones partido a partido (planificado). */
    MATCH_DAY;

    /**
     * Parsea un string al enum de forma tolerante a nulos o mayúsculas.
     * Retorna FULL_BRACKET por defecto.
     *
     * @param val Cadena a parsear.
     * @return PoolFormat correspondiente o FULL_BRACKET.
     */
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
