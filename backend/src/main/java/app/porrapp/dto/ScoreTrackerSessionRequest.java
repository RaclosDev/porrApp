package app.porrapp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Partida nueva en el día de juego en curso (si no hay, se empieza uno). Sin juego sigue con el de la
 * partida anterior; sin jugadores juegan todos los asistentes del día. {@code plannedRounds} es opcional.
 */
public record ScoreTrackerSessionRequest(Long gameId, @Size(max = 20) List<Long> playerIds,
                                         @Min(1) @Max(500) Integer plannedRounds) {
}
