package com.porra.mundial.model;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports) y el resto son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS;

    public static Sport ofExternalId(String externalId) {
        return externalId != null && externalId.trim().toLowerCase(Locale.ROOT).startsWith("lol.")
                ? LEAGUE_OF_LEGENDS : FOOTBALL;
    }
}
