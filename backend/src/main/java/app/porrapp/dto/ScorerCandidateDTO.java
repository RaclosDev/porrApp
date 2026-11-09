package app.porrapp.dto;

/**
 * Jugador que se puede elegir como pichichi de una competición.
 *
 * @param playerId  id del jugador en el proveedor; vacío si solo se conoce por su nombre
 * @param name      nombre completo
 * @param shortName nombre corto con el que lo muestra el proveedor
 * @param team      equipo o selección
 * @param position  posición en el campo
 * @param goals     goles que lleva en la competición
 */
public record ScorerCandidateDTO(
        String playerId,
        String name,
        String shortName,
        String team,
        String position,
        int goals) {
}
