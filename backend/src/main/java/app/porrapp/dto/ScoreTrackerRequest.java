package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Alta de un marcador; quien lo crea entra solo como jugador, así que los nombres de más son opcionales. */
public record ScoreTrackerRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 30) String unit,
        boolean lowerWins,
        @Size(max = 19) List<@NotBlank @Size(max = 40) String> players) {
}
