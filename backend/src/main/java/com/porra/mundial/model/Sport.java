package com.porra.mundial.model;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), los de tenis por {@code tennis.} (ESPN) y el resto
 * son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    TENNIS;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (id.startsWith("tennis.")) return TENNIS;
        return FOOTBALL;
    }

    /** La competición es un torneo de tenis oficial. */
    public static boolean isTennis(Competition competition) {
        return competition != null && competition.getOwnerLeague() == null
                && ofExternalId(competition.getExternalId()) == TENNIS;
    }
}
