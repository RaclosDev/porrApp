package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Alta de una liga de marcador, con su primer juego (nombre, unidad, forma de puntuar y si gana quien menos
 * suma); quien la crea entra solo como jugador, así que los nombres de más son opcionales. Sin
 * {@code mode} el juego es por puntos.
 */
public record ScoreTrackerRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 60) String gameName,
        @Size(max = 30) String unit,
        boolean lowerWins,
        @Size(max = 19) List<@NotBlank @Size(max = 40) String> players,
        @Pattern(regexp = "POINTS|WINS") String mode) {
}
