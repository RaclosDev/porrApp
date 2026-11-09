package app.porrapp.dto;

import java.util.List;

/**
 * Pichichi de una porra y a qué jugador se refiere.
 *
 * @param predictionId    porra a la que pertenece
 * @param userId          participante
 * @param participantName nombre del participante
 * @param writtenName     lo que escribió o eligió
 * @param status          {@code PLAYER} (jugador elegido de la lista o asignado), {@code MATCHED} (lo escrito
 *                        encaja con un solo jugador), {@code DOUBTFUL} (encaja con varios o con ninguno de la
 *                        lista) o {@code UNMATCHED} (sin lista de jugadores y sin goleador que encaje todavía)
 * @param playerId        id del jugador al que se refiere, si se sabe
 * @param playerName      nombre de ese jugador
 * @param team            su equipo
 * @param byAdmin         el jugador lo asignó el administrador
 * @param canAssign       el administrador puede asignarle un jugador ahora
 * @param candidates      si es dudoso, los jugadores con los que encaja lo escrito
 */
public record ScorerPickDTO(
        Long predictionId,
        Long userId,
        String participantName,
        String writtenName,
        String status,
        String playerId,
        String playerName,
        String team,
        boolean byAdmin,
        boolean canAssign,
        List<ScorerCandidateDTO> candidates) {

    public static final String PLAYER = "PLAYER";
    public static final String MATCHED = "MATCHED";
    public static final String DOUBTFUL = "DOUBTFUL";
    public static final String UNMATCHED = "UNMATCHED";
}
