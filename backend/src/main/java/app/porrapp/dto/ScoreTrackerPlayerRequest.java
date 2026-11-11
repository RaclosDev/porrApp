package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Jugador nuevo en un marcador. */
public record ScoreTrackerPlayerRequest(@NotBlank @Size(max = 40) String name) {
}
