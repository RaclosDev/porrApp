package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Alta de un juego en una liga de marcador. {@code mode}: {@code POINTS} (cada ronda apunta puntos; gana
 * quien más, o quien menos con {@code lowerWins}) o {@code WINS} (cada ronda apunta quién ganó). Sin él,
 * por puntos.
 */
public record ScoreGameRequest(
        @NotBlank @Size(max = 60) String name,
        @Size(max = 30) String unit,
        boolean lowerWins,
        @Pattern(regexp = "POINTS|WINS") String mode) {
}
