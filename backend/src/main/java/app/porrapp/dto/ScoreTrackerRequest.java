package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Alta de un marcador. */
public record ScoreTrackerRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 30) String unit,
        boolean lowerWins,
        @Size(min = 2, max = 20) List<@NotBlank @Size(max = 40) String> players) {
}
