package app.porrapp.dto;

import java.util.List;
import java.util.Map;

/**
 * Marcador completo para quien lo ve: jugadores, sesiones con su clasificación, partidas y la
 * clasificación acumulada de todas las sesiones.
 */
public record ScoreTrackerDTO(Long id, String name, String unit, boolean lowerWins, boolean owner,
                              String joinCode, Long currentSessionId, List<Player> players,
                              List<Session> sessions, List<Round> rounds, List<Standing> overall) {

    public record Player(Long id, String name) {
    }

    /** Sesión numerada desde 1, con su clasificación y quién la ganó (varios si hay empate). */
    public record Session(Long id, int number, String startedAt, int rounds, List<Standing> standings,
                          List<Long> winners) {
    }

    /** Puntos de la partida por id de jugador. */
    public record Round(Long id, Long sessionId, int number, String note, String createdAt,
                        Map<Long, Integer> scores) {
    }

    /**
     * Posición con empates (1, 1, 3…), total acumulado, partidas ganadas y sesiones ganadas (esto
     * último solo en la clasificación acumulada).
     */
    public record Standing(Long playerId, String name, int total, int rank, int roundsWon,
                           int sessionsWon) {
    }
}
