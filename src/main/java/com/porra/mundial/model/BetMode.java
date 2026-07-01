package com.porra.mundial.model;

/**
 * Enum que define el Modo de Juego (BetMode) para una Edición concreta.
 */
public enum BetMode {
    /** Pronóstico completo: fase de grupos y todo el árbol de eliminatorias. */
    FULL_BRACKET,
    /** Pronóstico parcial: solo se intenta adivinar desde Octavos en adelante. */
    KNOCKOUTS_ONLY,
    /** Pronóstico día a día: apuestas partido a partido (no implementado en V1). */
    MATCH_DAY
}
