package com.porra.mundial.model;

import com.porra.mundial.sports.NflSchedule;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), la Fórmula 1 es {@code f1} (ESPN), la NFL es {@code nfl}
 * (ESPN) y el resto son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    FORMULA_1,
    AMERICAN_FOOTBALL;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
    FORMULA_1,
    AMERICAN_FOOTBALL;
    }
}
