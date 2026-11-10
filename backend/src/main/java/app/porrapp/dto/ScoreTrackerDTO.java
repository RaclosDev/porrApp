package app.porrapp.dto;

import java.util.List;
import java.util.Map;

/**
 * Liga de marcador completa para quien la ve: juegos, jugadores, días de juego, partidas con su
 * clasificación, rondas, la clasificación general y la de cada juego. {@code unit} y {@code lowerWins}
 * son los del juego de la última partida. {@code myPlayerId} es el jugador que el usuario ha reclamado
 * como suyo y {@code claimedPlayerIds} los que ya tienen cuenta asociada. {@code currentDayId} es el día
 * de juego en curso, si lo hay.
 */
public record ScoreTrackerDTO(Long id, String name, String unit, boolean lowerWins, boolean owner,
                              String joinCode, Long myPlayerId, List<Long> claimedPlayerIds, Long currentSessionId,
                              Long currentGameId, List<Game> games, List<Player> players, List<Session> sessions,
                              List<Round> rounds, List<Standing> overall, List<GameStandings> byGame,
                              Long currentDayId, List<Day> days) {

    public record Player(Long id, String name) {
    }

    /** Un juego de la liga con su forma de puntuar ({@code POINTS} o {@code WINS}) y cuántas partidas y rondas lleva. */
    public record Game(Long id, String name, String unit, boolean lowerWins, int sessions, int rounds, String mode) {
    }

    /** Día de juego: cuándo empezó, si ya se cerró, quién vino y sus partidas en orden. */
    public record Day(Long id, String startedAt, String closedAt, List<Long> playerIds, List<Long> sessionIds,
                      String playedOn) {
    }

    /**
     * Partida numerada desde 1, de un juego y de un día, con sus participantes, su clasificación y quién la
     * ganó (varios si hay empate). {@code endedAt} vacío mientras está abierta.
     */
    public record Session(Long id, int number, Long gameId, String startedAt, int rounds, List<Standing> standings,
                          List<Long> winners, Long dayId, List<Long> playerIds, String endedAt,
                          Integer plannedRounds) {
    }

    /**
     * Ronda: puntos por id de jugador, solo de quienes la jugaron (en los juegos por victorias, 1 quien
     * ganó y 0 el resto). {@code recordedBy} es el nombre de quien la apuntó, si se sabe.
     */
    public record Round(Long id, Long sessionId, int number, String note, String createdAt,
                        Map<Long, Integer> scores, String recordedBy, int revision) {
    }

    /** Clasificación acumulada de todas las partidas de un juego. */
    public record GameStandings(Long gameId, List<Standing> standings) {
    }

    /**
     * Posición con empates (1, 1, 3…), total acumulado, rondas ganadas, partidas ganadas y partidas
     * jugadas (estas dos solo en las clasificaciones acumuladas).
     */
    public record Standing(Long playerId, String name, int total, int rank, int roundsWon,
                           int sessionsWon, int sessionsPlayed) {
    }
}
