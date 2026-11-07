package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.scoring.MatchScoreResult;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Reglas del modo superviviente. Cada elección es una predicción de partido con signo "1" (gana el
 * local) o "2" (gana el visitante). Sobrevive quien acierta; un empate o una derrota de su equipo lo
 * elimina. Una jornada sin elegir no suma, pero tampoco elimina.
 */
public final class SurvivorRules {
    private SurvivorRules() {}

    /** Puntos por cada jornada superada. */
    public static final int POINTS_PER_ROUND = 1;

    /** Equipo elegido, o null si el signo no es una elección válida. */
    public static Team pickedTeam(String sign, Match match) {
        if (match == null) return null;
        if ("1".equals(sign)) return match.getHomeTeam();
        if ("2".equals(sign)) return match.getAwayTeam();
        return null;
    }

    public static Team pickedTeam(MatchPrediction pick) {
        return pick == null ? null : pickedTeam(pick.getPredictionSign(), pick.getMatch());
    }

    /** Puntos de una elección con el marcador actual (provisional mientras el partido sigue en juego). */
    public static MatchScoreResult score(String sign, Integer home, Integer away, Team team) {
        String name = team != null && team.getName() != null ? team.getName() : "Tu equipo";
        if (home == null || away == null || !("1".equals(sign) || "2".equals(sign))) {
            return MatchScoreResult.zero("Sin elección");
        }
        boolean won = "1".equals(sign) ? home > away : away > home;
        return won
                ? new MatchScoreResult(POINTS_PER_ROUND, false, true, false, name + " gana: sobrevives")
                : MatchScoreResult.zero(name + " no gana: eliminado");
    }

    /** Si la elección está decidida y su equipo ganó. */
    static boolean won(MatchPrediction pick) {
        Match match = pick.getMatch();
        return isDecided(match) && score(pick.getPredictionSign(), match.getHomeScore(), match.getAwayScore(),
                pickedTeam(pick)).correctSign();
    }

    /** Solo un partido terminado con marcador elimina o hace sobrevivir. */
    static boolean isDecided(Match match) {
        return match != null && Boolean.TRUE.equals(match.getFinished())
                && match.getHomeScore() != null && match.getAwayScore() != null;
    }

    /**
     * Situación de un participante: jornadas superadas hasta su primer fallo y si ya está eliminado.
     *
     * @param eliminatedAt fecha del partido que lo eliminó, o null si sigue vivo
     */
    public record Standing(int survived, boolean eliminated, Instant eliminatedAt) {}

    public static Standing standing(List<MatchPrediction> picks) {
        List<MatchPrediction> decided = picks.stream()
                .filter(Objects::nonNull)
                .filter(pick -> isDecided(pick.getMatch()))
                .sorted(Comparator.comparing(pick -> pick.getMatch().getMatchDate(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        int survived = 0;
        for (MatchPrediction pick : decided) {
            if (!won(pick)) {
                return new Standing(survived, true, pick.getMatch().getMatchDate());
            }
            survived++;
        }
        return new Standing(survived, false, null);
    }
}
