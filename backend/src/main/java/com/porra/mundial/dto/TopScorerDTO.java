package com.porra.mundial.dto;

/**
 * Goleador del torneo con los goles marcados hasta ahora.
 *
 * @param name      nombre completo del jugador
 * @param shortName nombre corto con el que lo muestra ESPN
 * @param goals     goles marcados
 * @param position  posición en el campo
 * @param playerId  id del jugador en ESPN
 * @param team      selección
 * @param imageUrl  foto del jugador, o cadena vacía si no hay
 */
public record TopScorerDTO(
        String name,
        String shortName,
        int goals,
        String position,
        String playerId,
        String team,
        String imageUrl) {
}
