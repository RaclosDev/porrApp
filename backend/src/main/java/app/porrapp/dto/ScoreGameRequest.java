package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;

/**
 * Alta de un juego en una liga de marcador. {@code mode}: {@code POINTS} (cada ronda apunta puntos; gana
 * quien más, o quien menos con {@code lowerWins}), {@code ROUNDS} (puntos por ronda, gana quien gana más
 * rondas), {@code WINS} (victorias por ronda) o {@code DIRECT} (ganador de una partida).
 * {@code targetWins} permite terminar automáticamente al ganar ese número de rondas. Sin modo, por puntos.
 */
public record ScoreGameRequest(
        @NotBlank @Size(max = 60) String name,
        @Size(max = 30) String unit,
        boolean lowerWins,
        @Pattern(regexp = "POINTS|WINS|DIRECT|ROUNDS") String mode,
        @Min(1) @Max(500) Integer targetWins) {
}
