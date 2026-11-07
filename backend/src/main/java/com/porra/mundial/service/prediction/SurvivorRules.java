package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.scoring.MatchScoreResult;

import com.porra.mundial.util.MatchRound;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
     * Situación de un participante: jornadas superadas hasta su primera caída y si ya está eliminado.
     *
     * @param eliminatedAt    cuándo cayó (su partido, o el último partido de la jornada que no eligió);
     *                        null si sigue vivo
     * @param eliminatedRound jornada en que cayó, o null si sigue vivo
     * @param missed          cayó por no elegir equipo en una jornada
     */
    public record Standing(int survived, boolean eliminated, Instant eliminatedAt, String eliminatedRound,
                           boolean missed) {
        static Standing alive(int survived) {
            return new Standing(survived, false, null, null, false);
        }
    }

    /** Situación teniendo en cuenta solo las elecciones hechas (sin calendario no hay jornadas sin elegir). */
    public static Standing standing(List<MatchPrediction> picks) {
        return standing(picks, List.of(), null, null);
    }

    /**
     * Situación de un participante recorriendo las jornadas en orden. Una jornada con elección suma si
     * su equipo gana y elimina si no gana. Una jornada sin elección elimina en cuanto han empezado
     * todos sus partidos (ya no se puede elegir), salvo que empezara antes de que el participante
     * entrase en la liga.
     *
     * @param calendar partidos de la competición; vacío para no contar las jornadas sin elegir
     * @param startAt  desde cuándo juega el participante (al unirse a la liga); null para no contarlas
     * @param now      momento de la comprobación
     */
    public static Standing standing(List<MatchPrediction> picks, List<Match> calendar, Instant startAt, Instant now) {
        Map<String, MatchPrediction> pickByRound = new HashMap<>();
        Map<String, List<Match>> rounds = new LinkedHashMap<>();
        for (Match match : calendar) {
            if (match == null || (Team.isPlaceholder(match.getHomeTeam()) && Team.isPlaceholder(match.getAwayTeam()))) {
                continue;
            }
            rounds.computeIfAbsent(MatchRound.label(match), key -> new ArrayList<>()).add(match);
        }
        for (MatchPrediction pick : picks) {
            if (pick == null || pick.getMatch() == null) continue;
            String round = MatchRound.label(pick.getMatch());
            pickByRound.merge(round, pick, (a, b) -> a);
            rounds.computeIfAbsent(round, key -> new ArrayList<>(List.of(pick.getMatch())));
        }

        List<Map.Entry<String, List<Match>>> ordered = new ArrayList<>(rounds.entrySet());
        ordered.sort(Comparator.comparing(entry -> firstStart(entry.getValue()),
                Comparator.nullsLast(Comparator.naturalOrder())));

        int survived = 0;
        for (Map.Entry<String, List<Match>> round : ordered) {
            MatchPrediction pick = pickByRound.get(round.getKey());
            if (pick != null) {
                if (!isDecided(pick.getMatch())) continue;
                if (!won(pick)) {
                    return new Standing(survived, true, pick.getMatch().getMatchDate(), round.getKey(), false);
                }
                survived++;
                continue;
            }
            Instant first = firstStart(round.getValue());
            Instant last = lastStart(round.getValue());
            boolean countsForPlayer = startAt != null && first != null && !first.isBefore(startAt);
            if (countsForPlayer && now != null && last != null && !last.isAfter(now)) {
                return new Standing(survived, true, last, round.getKey(), true);
            }
        }
        return Standing.alive(survived);
    }

    private static Instant firstStart(List<Match> matches) {
        return matches.stream().map(Match::getMatchDate).filter(Objects::nonNull)
                .min(Comparator.naturalOrder()).orElse(null);
    }

    /** Inicio del último partido de la jornada; null si alguno no tiene fecha (aún se podría elegir). */
    private static Instant lastStart(List<Match> matches) {
        if (matches.stream().anyMatch(match -> match.getMatchDate() == null)) return null;
        return matches.stream().map(Match::getMatchDate).max(Comparator.naturalOrder()).orElse(null);
    }
}
