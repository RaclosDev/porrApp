package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Alta de un juego en una liga de marcador (o cambio de su nombre). */
public record ScoreGameRequest(
        @NotBlank @Size(max = 60) String name,
        @Size(max = 30) String unit,
        boolean lowerWins) {
}
