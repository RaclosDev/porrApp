package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Alta de un grupo de juego. Los campos del primer juego se admiten para clientes anteriores. */
public record ScoreTrackerRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 60) String gameName,
        @Size(max = 30) String unit,
        Boolean lowerWins,
        @Size(max = 19) List<@NotBlank @Size(max = 40) String> players,
        @Pattern(regexp = "POINTS|WINS|DIRECT") String mode) {
    /** La web no envía {@code lowerWins} cuando no aplica: ausente equivale a {@code false}. */
    public ScoreTrackerRequest {
        lowerWins = Boolean.TRUE.equals(lowerWins);
    }
}
