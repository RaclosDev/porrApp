package app.porrapp.model;

import app.porrapp.sports.NflSchedule;

import java.util.Locale;

/**
 * Deporte de una competición oficial. Sale de su id en el proveedor de datos: los de League of
 * Legends empiezan por {@code lol.} (LoL Esports); la Fórmula 1 es {@code f1}, la NBA {@code nba} y la NFL
 * {@code nfl} (ESPN); los de tenis empiezan por {@code tennis.} y los de artes marciales mixtas por {@code mma.}
 * (la UFC, de ESPN), y el resto son de fútbol (ESPN).
 */
public enum Sport {
    FOOTBALL,
    LEAGUE_OF_LEGENDS,
    FORMULA_1,
    BASKETBALL,
    AMERICAN_FOOTBALL,
    TENNIS,
    MMA;

    public static Sport ofExternalId(String externalId) {
        String id = externalId == null ? "" : externalId.trim().toLowerCase(Locale.ROOT);
        if (id.startsWith("lol.")) return LEAGUE_OF_LEGENDS;
        if (id.startsWith("mma.")) return MMA;
        if (Competition.FORMULA_ONE_EXTERNAL_ID.equals(id)) return FORMULA_1;
        if (id.startsWith("tennis.")) return TENNIS;
        if (Competition.NBA_EXTERNAL_ID.equals(id) || Competition.NBA_REGULAR_SEASON_EXTERNAL_ID.equals(id)) {
            return BASKETBALL;
        }
        if (NflSchedule.EXTERNAL_ID.equals(id)) return AMERICAN_FOOTBALL;
        return FOOTBALL;
    }

    /** Si la competición es de MMA: cada partido es una pelea de una velada. */
    public static boolean isMma(Competition competition) {
        return competition != null && ofExternalId(competition.getExternalId()) == MMA;
    }

    /**
     * Si un partido puede acabar en empate y se puede predecir la X. Solo en el fútbol: en la NFL, la NBA,
     * el LoL (una serie siempre la gana alguien), el tenis y la UFC se predice el ganador.
     */
    public boolean allowsDraws() {
        return this == FOOTBALL;
    }

    /** Si el partido admite predecir el empate; sin competición, como en fútbol. */
    public static boolean allowsDraws(Match match) {
        Competition competition = match == null ? null : match.getCompetition();
        return competition == null || competition.rulesSport().allowsDraws();
    }

    /** La competición es un torneo de tenis oficial. */
    public static boolean isTennis(Competition competition) {
        return competition != null && competition.getOwnerLeague() == null
                && ofExternalId(competition.getExternalId()) == TENNIS;
    }
}
