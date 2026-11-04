package com.porra.mundial.service;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Rondas del cuadro que se pronostica ronda a ronda (ganador de cada cruce). En una competición
 * personalizada son las rondas "bracket-N"; en un torneo oficial con cuadro propio, sus rondas
 * eliminatorias reales desde la primera que tenga cruces, con la primera ordenada por fecha.
 */
final class PredictableBracket {
    private static final List<String> KNOCKOUT_ROUNDS = List.of("r32", "r16", "qf", "sf", "final");

    private static final Comparator<Match> BY_ID =
            Comparator.comparing(Match::getId, Comparator.nullsLast(Comparator.<Long>naturalOrder()));

    private PredictableBracket() {
    }

    /** La edición se pronostica sobre un cuadro propio (personalizado u oficial que no es el Mundial). */
    static boolean applies(Edition edition) {
        if (edition == null || edition.getPoolFormat() == PoolFormat.MATCH_DAY) return false;
        Competition competition = edition.getCompetition();
        return competition != null && (competition.getOwnerLeague() != null || competition.hasOwnBracket());
    }

    /** Partidos de cada ronda, de la primera a la última; la primera en el orden en que se pinta. */
    static List<List<Match>> rounds(Competition competition, List<Match> all) {
        List<List<Match>> result = new ArrayList<>();
        if (competition.getOwnerLeague() != null) {
            Map<Integer, List<Match>> byRound = all.stream()
                    .filter(match -> match.getRound() != null && match.getRound().matches("bracket-[1-9][0-9]*"))
                    .collect(Collectors.groupingBy(match -> Integer.parseInt(match.getRound().substring(8))));
            int last = byRound.keySet().stream().mapToInt(Integer::intValue).max().orElse(0);
            for (int round = 1; round <= last; round++) {
                result.add(byRound.getOrDefault(round, List.of()).stream().sorted(BY_ID).toList());
            }
            return result;
        }
        Map<String, List<Match>> byRound = all.stream()
                .filter(match -> KNOCKOUT_ROUNDS.contains(match.getRound()))
                .collect(Collectors.groupingBy(Match::getRound));
        int first = 0;
        while (first < KNOCKOUT_ROUNDS.size() && !byRound.containsKey(KNOCKOUT_ROUNDS.get(first))) first++;
        Comparator<Match> byDate = Comparator.comparing(Match::getMatchDate,
                Comparator.nullsLast(Comparator.<LocalDateTime>naturalOrder())).thenComparing(BY_ID);
        for (int index = first; index < KNOCKOUT_ROUNDS.size(); index++) {
            result.add(byRound.getOrDefault(KNOCKOUT_ROUNDS.get(index), List.of()).stream().sorted(byDate).toList());
        }
        return result;
    }
}
