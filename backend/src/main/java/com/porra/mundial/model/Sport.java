package com.porra.mundial.model;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), los de artes marciales mixtas por {@code mma.}
 * (la UFC, de ESPN) y el resto son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    MMA;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (id.startsWith("mma.")) return MMA;
        return FOOTBALL;
    }

    /** Si la competición es de MMA: cada partido es una pelea de una velada. */
    public static boolean isMma(Competition competition) {
        return competition != null && ofExternalId(competition.getExternalId()) == MMA;
    }
}
