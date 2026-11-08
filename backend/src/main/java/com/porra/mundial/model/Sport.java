package com.porra.mundial.model;

import com.porra.mundial.sports.NflSchedule;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), los de artes marciales mixtas por {@code mma.}
 * (la UFC, de ESPN), la NFL es {@code nfl} (ESPN) y el resto son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    AMERICAN_FOOTBALL,
    MMA;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (id.startsWith("mma.")) return MMA;
        if (NflSchedule.EXTERNAL_ID.equals(id)) return AMERICAN_FOOTBALL;
        return FOOTBALL;
    }

    /** Si la competición es de MMA: cada partido es una pelea de una velada. */
    public static boolean isMma(Competition competition) {
        return competition != null && ofExternalId(competition.getExternalId()) == MMA;
    }

    /** Si un partido puede acabar en empate y se puede predecir la X. En la NFL y la UFC se predice el ganador. */
    public boolean allowsDraws() {
        return this != AMERICAN_FOOTBALL && this != MMA;
    }

    /** Si el partido admite predecir el empate; sin competición, como en fútbol. */
    public static boolean allowsDraws(Match match) {
        Competition competition = match == null ? null : match.getCompetition();
        return competition == null || ofExternalId(competition.getExternalId()).allowsDraws();
    }
}
