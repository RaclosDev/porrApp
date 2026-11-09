package app.porrapp.model;

import app.porrapp.sports.TennisTournaments;

/**
 * Qué torneos sigue una liga de tenis de varios torneos: todos los del catálogo, solo los Grand Slams o
 * solo los Masters 1000 y WTA 1000 con las finales de temporada (ATP Finals y WTA Finals). Sin valor, la liga es de un solo torneo (como hasta ahora).
 */
public enum TennisScope {
    ALL,
    GRAND_SLAMS,
    MASTERS_1000;

    /** Nombre visible de la liga en lugar del de un torneo. */
    public String label() {
        return switch (this) {
            case ALL -> "Tenis: todos los torneos";
            case GRAND_SLAMS -> "Tenis: Grand Slams";
            case MASTERS_1000 -> "Tenis: Masters 1000, WTA 1000 y Finals";
        };
    }

    /** Si los torneos de esa categoría entran en el alcance. */
    public boolean includes(TennisTournaments.Level level) {
        return switch (this) {
            case ALL -> true;
            case GRAND_SLAMS -> level == TennisTournaments.Level.GRAND_SLAM;
            case MASTERS_1000 -> level == TennisTournaments.Level.MASTERS_1000
                    || level == TennisTournaments.Level.FINALS;
        };
    }
}
