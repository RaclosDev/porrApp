package com.porra.mundial.model;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), la Fórmula 1 es {@code f1} (ESPN) y el resto son de
 * fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    FORMULA_1;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (Competition.FORMULA_ONE_EXTERNAL_ID.equals(id)) return FORMULA_1;
        return FOOTBALL;
    }
}
