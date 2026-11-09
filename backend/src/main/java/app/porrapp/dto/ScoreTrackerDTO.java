package app.porrapp.dto;

import java.util.List;
import java.util.Map;

/**
 * Liga de marcador completa para quien la ve: juegos, jugadores, sesiones con su clasificación, partidas,
 * la clasificación general y la de cada juego. {@code unit} y {@code lowerWins} son los del juego en curso.
 * {@code myPlayerId} es el jugador que el usuario ha reclamado como suyo y {@code claimedPlayerIds} los
 * que ya tienen cuenta asociada.
 */
public record ScoreTrackerDTO(Long id, String name, String unit, boolean lowerWins, boolean owner,
                              String joinCode, Long myPlayerId, List<Long> claimedPlayerIds, Long currentSessionId,
                              Long currentGameId, List<Game> games, List<Player> players, List<Session> sessions,
                              List<Round> rounds, List<Standing> overall, List<GameStandings> byGame) {

    public record Player(Long id, String name) {
    }

    /** Un juego de la liga con cuántas sesiones y partidas lleva. */
    public record Game(Long id, String name, String unit, boolean lowerWins, int sessions, int rounds) {
    }

    /** Sesión numerada desde 1, de un juego, con su clasificación y quién la ganó (varios si hay empate). */
    public record Session(Long id, int number, Long gameId, String startedAt, int rounds, List<Standing> standings,
                          List<Long> winners) {
    }

    /** Puntos de la partida por id de jugador. */
    public record Round(Long id, Long sessionId, int number, String note, String createdAt,
                        Map<Long, Integer> scores) {
    }

    /** Clasificación acumulada de todas las sesiones de un juego. */
    public record GameStandings(Long gameId, List<Standing> standings) {
    }

    /**
     * Posición con empates (1, 1, 3…), total acumulado, partidas ganadas y sesiones ganadas (esto
     * último solo en las clasificaciones acumuladas).
     */
    public record Standing(Long playerId, String name, int total, int rank, int roundsWon,
                           int sessionsWon) {
    }
}
