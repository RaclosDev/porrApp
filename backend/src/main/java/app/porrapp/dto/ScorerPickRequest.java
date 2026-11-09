package app.porrapp.dto;

import jakarta.validation.constraints.Size;

/**
 * Pichichi que elige un participante o jugador que asigna el administrador.
 *
 * @param name     nombre escrito a mano; se ignora si viene {@code playerId}
 * @param playerId id del jugador elegido de la lista de la competición
 */
public record ScorerPickRequest(
        @Size(max = 120, message = "El nombre del pichichi es demasiado largo") String name,
        @Size(max = 255) String playerId) {
}
