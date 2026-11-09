package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Entrar a un marcador con su código. */
public record ScoreTrackerJoinRequest(@NotBlank @Size(max = 12) String code) {
}
