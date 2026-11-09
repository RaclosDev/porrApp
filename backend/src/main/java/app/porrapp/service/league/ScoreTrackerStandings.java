package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerDTO.Standing;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Clasificación de un marcador a partir de los puntos de cada partida. */
final class ScoreTrackerStandings {

    private ScoreTrackerStandings() {
    }

    /**
     * Clasificación ordenada, con posición con empates (1, 1, 3…). Cada partida trae los puntos de
     * todos los jugadores; gana la partida quien más suma, o quien menos si {@code lowerWins}.
     *
     * @param sessionsWon sesiones ganadas por jugador (vacío en la clasificación de una sesión)
     */
    static List<Standing> rank(List<Player> players, boolean lowerWins, List<Map<Long, Integer>> rounds,
                               Map<Long, Integer> sessionsWon) {
        Map<Long, Integer> totals = new HashMap<>();
        Map<Long, Integer> roundsWon = new HashMap<>();
        for (Map<Long, Integer> round : rounds) {
            Integer best = null;
            for (Player player : players) {
                int points = round.getOrDefault(player.id(), 0);
                totals.merge(player.id(), points, Integer::sum);
                if (best == null || (lowerWins ? points < best : points > best)) best = points;
            }
            if (best == null) continue;
            for (Player player : players) {
                if (round.getOrDefault(player.id(), 0).equals(best)) roundsWon.merge(player.id(), 1, Integer::sum);
            }
        }
        Comparator<Player> order = Comparator
                .comparingInt((Player player) -> totals.getOrDefault(player.id(), 0))
                .thenComparing(Player::name, String.CASE_INSENSITIVE_ORDER);
        List<Player> sorted = new ArrayList<>(players);
        sorted.sort(lowerWins ? order : Comparator
                .comparingInt((Player player) -> -totals.getOrDefault(player.id(), 0))
                .thenComparing(Player::name, String.CASE_INSENSITIVE_ORDER));
        List<Standing> standings = new ArrayList<>();
        int rank = 0;
        Integer previous = null;
        for (int index = 0; index < sorted.size(); index++) {
            Player player = sorted.get(index);
            int total = totals.getOrDefault(player.id(), 0);
            if (previous == null || total != previous) rank = index + 1;
            previous = total;
            standings.add(new Standing(player.id(), player.name(), total, rank,
                    roundsWon.getOrDefault(player.id(), 0), sessionsWon.getOrDefault(player.id(), 0)));
        }
        return standings;
    }

    /** Quienes van primeros; nadie si no se ha jugado ninguna partida. */
    static List<Long> leaders(List<Standing> standings, int rounds) {
        if (rounds == 0) return List.of();
        return standings.stream().filter(standing -> standing.rank() == 1).map(Standing::playerId).toList();
    }
}
