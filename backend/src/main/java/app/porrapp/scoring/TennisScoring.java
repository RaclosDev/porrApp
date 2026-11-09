package app.porrapp.scoring;

import app.porrapp.model.Competition;
import app.porrapp.model.Match;
import app.porrapp.model.Sport;
import app.porrapp.model.Team;
import app.porrapp.sports.TennisTournaments;

import java.util.Objects;

/**
 * Puntos de un partido de tenis: acertar quién gana vale más en cada ronda (octavos, cuartos, semifinales
 * y final) y acertar además los sets (3-1) suma un extra. Una retirada o un W.O. solo cuentan el ganador.
 * Solo puntúa el partido terminado: un set de ventaja no es una victoria.
 */
public final class TennisScoring {

    private TennisScoring() {
    }

    /** El partido es de un torneo de tenis oficial. */
    public static boolean applies(Match match) {
        return match != null && Sport.isTennis(match.getCompetition());
    }

    /** Sets que hay que ganar en un partido de la competición: 3 en los Grand Slams masculinos, 2 en el resto. */
    public static int setsToWin(Competition competition) {
        return TennisTournaments.setsToWin(competition == null ? null : competition.getExternalId());
    }

    /** Puntos por acertar el ganador según la ronda; la fase de grupos de las ATP Finals vale como octavos. */
    public static int roundPoints(String round, ScoringRuleSet rules) {
        return switch (round == null ? "" : round) {
            case "qf" -> rules.getQuarterFinalPoints();
            case "sf" -> rules.getSemiFinalPoints();
            case "final" -> rules.getChampionPoints();
            default -> rules.getRoundOf16Points();
        };
    }

    /**
     * Si un pronóstico de sets es válido: gana uno de los dos con los sets justos y el otro con menos
     * (2-0 o 2-1 al mejor de tres; 3-0, 3-1 o 3-2 al mejor de cinco).
     */
    public static boolean validSets(int home, int away, int setsToWin) {
        int winner = Math.max(home, away);
        int loser = Math.min(home, away);
        return home >= 0 && away >= 0 && winner == setsToWin && loser < setsToWin;
    }

    /** "1" si gana el primer jugador, "2" si gana el segundo, null si aún no hay ganador. */
    public static String winnerSign(Match match) {
        if (match == null || !Boolean.TRUE.equals(match.getFinished())) return null;
        Team winner = match.getWinnerTeam();
        if (winner != null && winner.getId() != null) {
            if (sameTeam(winner, match.getHomeTeam())) return "1";
            if (sameTeam(winner, match.getAwayTeam())) return "2";
        }
        Integer home = match.getHomeScore();
        Integer away = match.getAwayScore();
        if (home == null || away == null || home.equals(away)) return null;
        return home > away ? "1" : "2";
    }

    /** Si el partido ya da puntos: terminado y con ganador. */
    public static boolean decided(Match match) {
        return winnerSign(match) != null;
    }

    public static MatchScoreResult score(String predictedSign, Integer predictedHome, Integer predictedAway,
                                         Match match, ScoringRuleSet rules) {
        ScoringRuleSet effective = rules != null ? rules : ScoringRuleSet.defaultTennis();
        String winner = winnerSign(match);
        if (winner == null) return MatchScoreResult.zero("Partido sin terminar");
        if (!winner.equals(predictedSign)) return MatchScoreResult.zero("Sin acierto en el ganador (0 pts)");
        int points = roundPoints(match.getRound(), effective);
        boolean exactSets = predictedHome != null && predictedAway != null
                && predictedHome.equals(match.getHomeScore()) && predictedAway.equals(match.getAwayScore());
        if (exactSets) {
            int total = points + effective.getExactScorePoints();
            return new MatchScoreResult(total, true, true, true, String.format(
                    "Ganador y sets acertados, %d-%d (%d pts)", predictedHome, predictedAway, total));
        }
        return new MatchScoreResult(points, false, true, false, String.format("Ganador acertado (%d pts)", points));
    }

    private static boolean sameTeam(Team left, Team right) {
        return right != null && Objects.equals(left.getId(), right.getId());
    }
}
