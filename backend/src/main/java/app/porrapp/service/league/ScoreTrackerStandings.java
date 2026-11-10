package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerDTO.Standing;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Clasificación de una liga de marcador a partir de los puntos de cada ronda. */
final class ScoreTrackerStandings {

    private ScoreTrackerStandings() {
    }

    /**
     * Clasificación de una partida, con posición con empates (1, 1, 3…). Cada ronda trae solo los puntos
     * de quienes la jugaron: quien falta no suma ni compite por ganarla. Gana la ronda quien más suma entre
     * los presentes, o quien menos si {@code lowerWins}. Quien no ha jugado ninguna ronda va detrás.
     */
    static List<Standing> rank(List<Player> players, boolean lowerWins, List<Map<Long, Integer>> rounds) {
        Map<Long, Integer> totals = new HashMap<>();
        Map<Long, Integer> roundsWon = new HashMap<>();
        Set<Long> played = new HashSet<>();
        for (Map<Long, Integer> round : rounds) {
            Integer best = null;
            for (Player player : players) {
                Integer points = round.get(player.id());
                if (points == null) continue;
                played.add(player.id());
                totals.merge(player.id(), points, Integer::sum);
                if (best == null || (lowerWins ? points < best : points > best)) best = points;
            }
            if (best == null) continue;
            for (Player player : players) {
                if (best.equals(round.get(player.id()))) roundsWon.merge(player.id(), 1, Integer::sum);
            }
        }
        Comparator<Player> byTotal = Comparator.comparingInt(
                (Player player) -> (lowerWins ? 1 : -1) * totals.getOrDefault(player.id(), 0));
        List<Player> sorted = new ArrayList<>(players);
        sorted.sort(Comparator.comparingInt((Player player) -> played.contains(player.id()) ? 0 : 1)
                .thenComparing(byTotal)
                .thenComparing(Player::name, String.CASE_INSENSITIVE_ORDER));
        List<Standing> standings = new ArrayList<>();
        int rank = 0;
        Integer previous = null;
        Boolean previousPlayed = null;
        for (int index = 0; index < sorted.size(); index++) {
            Player player = sorted.get(index);
            int total = totals.getOrDefault(player.id(), 0);
            boolean hasPlayed = played.contains(player.id());
            if (previous == null || total != previous || hasPlayed != previousPlayed) rank = index + 1;
            previous = total;
            previousPlayed = hasPlayed;
            standings.add(new Standing(player.id(), player.name(), total, rank,
                    roundsWon.getOrDefault(player.id(), 0), 0, 0));
        }
        return standings;
    }

    /**
     * Clasificación acumulada (general o de un juego): los puntos de un juego no se pueden sumar con los de
     * otro, así que manda quién ha ganado más partidas. Las rondas y los puntos solo son informativos.
     */
    static List<Standing> general(List<Player> players, Map<Long, Integer> totals, Map<Long, Integer> roundsWon,
                                  Map<Long, Integer> sessionsWon, Map<Long, Integer> sessionsPlayed) {
        List<Player> sorted = new ArrayList<>(players);
        sorted.sort(Comparator
                .comparingInt((Player player) -> -sessionsWon.getOrDefault(player.id(), 0))
                .thenComparing(Player::name, String.CASE_INSENSITIVE_ORDER));
        List<Standing> standings = new ArrayList<>();
        int rank = 0;
        int previousSessions = -1;
        for (int index = 0; index < sorted.size(); index++) {
            Player player = sorted.get(index);
            int sessions = sessionsWon.getOrDefault(player.id(), 0);
            int rounds = roundsWon.getOrDefault(player.id(), 0);
            if (sessions != previousSessions) rank = index + 1;
            previousSessions = sessions;
            standings.add(new Standing(player.id(), player.name(), totals.getOrDefault(player.id(), 0), rank,
                    rounds, sessions, sessionsPlayed.getOrDefault(player.id(), 0)));
        }
        return standings;
    }

    /** Quienes van primeros entre los que han jugado; nadie si no se ha jugado ninguna ronda. */
    static List<Long> leaders(List<Standing> standings, int rounds) {
        if (rounds == 0) return List.of();
        return standings.stream().filter(standing -> standing.rank() == 1).map(Standing::playerId).toList();
    }
}
