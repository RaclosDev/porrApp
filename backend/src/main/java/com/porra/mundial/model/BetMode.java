package com.porra.mundial.model;

/**
 * Enum que define el Modo de Juego (BetMode) para una Edición concreta.
 *
 * @deprecated Usar {@link PoolFormat}. Se mantiene por compatibilidad hacia atrás.
 */
@Deprecated
public enum BetMode {
    /** Pronóstico completo: fase de grupos y todo el árbol de eliminatorias. */
    FULL_BRACKET,
    /** Pronóstico parcial: solo se intenta adivinar desde Octavos en adelante. */
    KNOCKOUTS_ONLY,
    /** Pronóstico día a día: apuestas partido a partido (no implementado en V1). */
    MATCH_DAY;

    public PoolFormat toPoolFormat() {
        return PoolFormat.fromString(this.name());
    }

    public static BetMode fromPoolFormat(PoolFormat format) {
        if (format == null) return FULL_BRACKET;
        try {
            return BetMode.valueOf(format.name());
        } catch (IllegalArgumentException e) {
            return FULL_BRACKET;
        }
    }
}
