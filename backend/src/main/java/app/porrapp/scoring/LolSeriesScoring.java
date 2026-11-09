package app.porrapp.scoring;

import app.porrapp.model.Match;
import app.porrapp.model.Sport;

/**
 * Puntos de una serie de League of Legends por jornadas: acertar quién gana vale el signo y acertar además
 * el resultado de la serie (3-1 al mejor de cinco) vale el resultado exacto, sin sumarse al ganador. Una
 * serie al mejor de uno solo tiene ganador: su 1-0 no es un resultado aparte.
 */
public final class LolSeriesScoring {

    private LolSeriesScoring() {
    }

    /** El partido es una serie de una competición oficial de LoL. */
    public static boolean applies(Match match) {
        return match != null && match.getCompetition() != null && match.getCompetition().getOwnerLeague() == null
                && Sport.ofExternalId(match.getCompetition().getExternalId()) == Sport.LEAGUE_OF_LEGENDS;
    }

    /**
     * Partidas que hay que ganar si la serie admite predecir su resultado: 2 al mejor de tres, 3 al mejor
     * de cinco. Null al mejor de uno o si no se sabe al mejor de cuántas se juega.
     */
    public static Integer gamesToWin(Match match) {
        Integer bestOf = match == null ? null : match.getBestOf();
        return bestOf != null && bestOf > 1 ? bestOf / 2 + 1 : null;
    }

    /** Si la serie ya da puntos: terminada y con ganador. En directo, ir 1-0 en un Bo5 no es ganarla. */
    public static boolean decided(Match match) {
        return match != null && Boolean.TRUE.equals(match.getFinished()) && match.getHomeScore() != null
                && match.getAwayScore() != null && !match.getHomeScore().equals(match.getAwayScore());
    }

    public static MatchScoreResult score(String predictedSign, Integer predictedHome, Integer predictedAway,
                                         Match match, ScoringRuleSet rules) {
        ScoringRuleSet effective = rules != null ? rules : ScoringRuleSet.defaults();
        Integer home = match.getHomeScore();
        Integer away = match.getAwayScore();
        if (home == null || away == null || home.equals(away)) return MatchScoreResult.zero("Serie sin ganador");
        String winner = home > away ? "1" : "2";
        if (!winner.equals(predictedSign)) return MatchScoreResult.zero("Sin acierto en el ganador (0 pts)");
        int points = effective.getCorrectSignPoints();
        boolean exactSeries = gamesToWin(match) != null && predictedHome != null && predictedAway != null
                && predictedHome.equals(home) && predictedAway.equals(away);
        if (exactSeries) {
            int total = Math.max(points, effective.getExactScorePoints());
            return new MatchScoreResult(total, true, true, true, String.format(
                    "Ganador y resultado de la serie acertados, %d-%d (%d pts)", home, away, total));
        }
        return new MatchScoreResult(points, false, true, false, String.format("Ganador acertado (%d pts)", points));
    }
}
