package com.porra.mundial.model;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), la NBA es {@code nba} (ESPN) y el resto son de
 * fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    BASKETBALL;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (Competition.NBA_EXTERNAL_ID.equals(id)) return BASKETBALL;
        return FOOTBALL;
    }
}
