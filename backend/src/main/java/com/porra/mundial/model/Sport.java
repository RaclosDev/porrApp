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
        if (Competition.FORMULA_ONE_EXTERNAL_ID.equals(id)) return FORMULA_1;
        if (NflSchedule.EXTERNAL_ID.equals(id)) return AMERICAN_FOOTBALL;
        return FOOTBALL;
    }

    /** Si un partido puede acabar en empate y se puede predecir la X. En la NFL se predice el ganador. */
    public boolean allowsDraws() {
        return this != AMERICAN_FOOTBALL;
    }

    /** Si el partido admite predecir el empate; sin competición, como en fútbol. */
    public static boolean allowsDraws(Match match) {
        Competition competition = match == null ? null : match.getCompetition();
        return competition == null || ofExternalId(competition.getExternalId()).allowsDraws();
    }
}
