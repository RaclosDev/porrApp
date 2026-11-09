package app.porrapp.service.prediction;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.PoolFormat;

import java.time.Instant;
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
public final class PredictableBracket {
    private static final List<String> KNOCKOUT_ROUNDS = List.of("r32", "r16", "qf", "sf", "final");

    private static final Comparator<Match> BY_ID =
            Comparator.comparing(Match::getId, Comparator.nullsLast(Comparator.<Long>naturalOrder()));

    private PredictableBracket() {
    }

    /** La edición se pronostica sobre un cuadro propio (personalizado u oficial que no es el Mundial). */
    public static boolean applies(Edition edition) {
        if (edition == null || PoolFormat.isMatchBased(edition.getPoolFormat())) return false;
        Competition competition = edition.getCompetition();
        return competition != null && (competition.getOwnerLeague() != null || competition.hasOwnBracket());
    }

    /**
     * Cuándo empieza lo que pronostica una liga nueva de cuadro en un torneo oficial con cuadro propio que no se
     * sortea ronda a ronda (los Worlds del LoL): su primer cruce con los dos equipos y, en el cuadro completo,
     * también el primer partido de grupos. Desde ese momento el cuadro ya no admite predicciones nuevas, así
     * que una liga creada entonces nacería sin que nadie pudiera jugar. Null si no aplica (personalizadas,
     * Mundial, cruces sorteados ronda a ronda, que sí admiten entrar tarde) o si aún no hay cruces definidos.
     */
    public static Instant predictionsCloseAt(Competition competition, PoolFormat format, List<Match> all) {
        if (competition == null || competition.getOwnerLeague() != null || !competition.hasOwnBracket()
                || competition.drawsKnockoutRounds()
                || format != PoolFormat.KNOCKOUTS_ONLY && format != PoolFormat.FULL_BRACKET) {
            return null;
        }
        List<List<Match>> bracket = rounds(competition, all);
        List<Match> candidates = new ArrayList<>(bracket.isEmpty() ? List.of() : bracket.get(0));
        if (format == PoolFormat.FULL_BRACKET) {
            all.stream().filter(match -> "group".equals(match.getRound()) && match.getGroupName() != null)
                    .forEach(candidates::add);
        }
        return candidates.stream()
                .filter(match -> match.getMatchDate() != null && match.getHomeTeam() != null && match.getAwayTeam() != null)
                .map(Match::getMatchDate).min(Comparator.naturalOrder()).orElse(null);
    }

    /** Partidos de cada ronda, de la primera a la última; la primera en el orden en que se pinta. */
    public static List<List<Match>> rounds(Competition competition, List<Match> all) {
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
                .filter(match -> match.getRound() != null && KNOCKOUT_ROUNDS.contains(match.getRound()))
                .collect(Collectors.groupingBy(Match::getRound));
        int first = 0;
        while (first < KNOCKOUT_ROUNDS.size() && !byRound.containsKey(KNOCKOUT_ROUNDS.get(first))) first++;
        Comparator<Match> byDate = Comparator.comparing(Match::getMatchDate,
                Comparator.nullsLast(Comparator.<Instant>naturalOrder())).thenComparing(BY_ID);
        for (int index = first; index < KNOCKOUT_ROUNDS.size(); index++) {
            result.add(byRound.getOrDefault(KNOCKOUT_ROUNDS.get(index), List.of()).stream().sorted(byDate).toList());
        }
        return result;
    }
}
