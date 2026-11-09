package app.porrapp.scoring;

import app.porrapp.model.Fight;
import app.porrapp.model.FightMethod;
import app.porrapp.model.Match;
import app.porrapp.model.Team;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Puntos de una predicción de pelea: el ganador y, si se aciertan, el método y el asalto. El método solo
 * suma con el ganador acertado y el asalto solo con el método acertado de un KO/TKO o una sumisión. Un
 * empate o una pelea sin resultado no dan puntos a nadie.
 */
public final class FightScoring {
    private FightScoring() {}

    /**
     * @param sign            luchador elegido: "1" la esquina roja (local), "2" la azul (visitante)
     * @param predictedMethod método elegido, o null
     * @param predictedRound  asalto elegido, o null
     * @return null si la pelea aún no ha acabado
     */
    public static MatchScoreResult score(String sign, String predictedMethod, Integer predictedRound,
                                         Match match, Fight fight, ScoringRuleSet rules) {
        if (match == null || !Boolean.TRUE.equals(match.getFinished())) return null;
        FightMethod result = fight == null ? null : fight.getResultMethod();
        Team winner = match.getWinnerTeam();
        if (winner == null || winner.getId() == null) {
            return MatchScoreResult.zero(result == FightMethod.NO_CONTEST ? "Sin resultado: no puntúa"
                    : "Empate: no puntúa");
        }
        Team picked = "1".equals(sign) ? match.getHomeTeam() : "2".equals(sign) ? match.getAwayTeam() : null;
        if (picked == null || !Objects.equals(picked.getId(), winner.getId())) {
            return MatchScoreResult.zero("Ganó " + winner.getName());
        }
        int points = rules.getFightWinnerPoints();
        List<String> parts = new ArrayList<>(List.of("Ganador +" + rules.getFightWinnerPoints()));
        FightMethod method = FightMethod.predicted(predictedMethod);
        boolean methodHit = method != null && method == result;
        if (methodHit) {
            points += rules.getFightMethodPoints();
            parts.add("Método +" + rules.getFightMethodPoints());
        }
        boolean roundHit = methodHit && method.finish() && predictedRound != null
                && fight.getResultRound() != null && predictedRound.equals(fight.getResultRound());
        if (roundHit) {
            points += rules.getFightRoundPoints();
            parts.add("Asalto +" + rules.getFightRoundPoints());
        }
        // Pleno: ganador y método y, si acabó antes del límite, también el asalto.
        boolean full = methodHit && (!method.finish() || roundHit);
        return new MatchScoreResult(points, full, true, false, String.join(" · ", parts) + " (" + points + " pts)");
    }
}
