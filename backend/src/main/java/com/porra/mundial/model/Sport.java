package com.porra.mundial.model;

import com.porra.mundial.sports.NflSchedule;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports), la NBA es {@code nba} y la NFL {@code nfl} (ESPN), los de
 * tenis empiezan por {@code tennis.} (ESPN) y el resto son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    BASKETBALL,
    AMERICAN_FOOTBALL,
    TENNIS;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (id.startsWith("tennis.")) return TENNIS;
        if (Competition.NBA_EXTERNAL_ID.equals(id)) return BASKETBALL;
        if (NflSchedule.EXTERNAL_ID.equals(id)) return AMERICAN_FOOTBALL;
        return FOOTBALL;
    }

    /** Si un partido puede acabar en empate y se puede predecir la X. En la NFL y en el tenis se predice el ganador. */
    public boolean allowsDraws() {
        return this != AMERICAN_FOOTBALL && this != TENNIS;
    }

    /** Si el partido admite predecir el empate; sin competición, como en fútbol. */
    public static boolean allowsDraws(Match match) {
        Competition competition = match == null ? null : match.getCompetition();
        return competition == null || ofExternalId(competition.getExternalId()).allowsDraws();
    }

    /** La competición es un torneo de tenis oficial. */
    public static boolean isTennis(Competition competition) {
        return competition != null && competition.getOwnerLeague() == null
                && ofExternalId(competition.getExternalId()) == TENNIS;
    }
}
