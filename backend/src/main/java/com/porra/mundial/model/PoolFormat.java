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
    MATCH_DAY,
    /**
     * Superviviente: en cada jornada se elige un equipo que gane, sin repetir equipo en toda la
     * temporada; si no gana (empate o derrota), quien lo eligió queda eliminado.
     */
    SURVIVOR,
    /**
     * Fórmula 1, Gran Premio a Gran Premio: podio, pole y vuelta rápida. Cada Gran Premio se cierra al
     * empezar la clasificación, que decide la pole.
     */
    GRAND_PRIX;

    /** Se juega partido a partido sobre el calendario (jornadas), no sobre un cuadro. */
    public boolean isMatchBased() {
        return this == MATCH_DAY || this == SURVIVOR;
    }

    /** Se juega carrera a carrera (Fórmula 1), con su propia predicción y puntuación. */
    public static boolean isRaceBased(PoolFormat format) {
        return format == GRAND_PRIX;
    }

    /** Si el formato de una edición se juega partido a partido; null cuenta como cuadro. */
    public static boolean isMatchBased(PoolFormat format) {
        return format != null && format.isMatchBased();
    }

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
