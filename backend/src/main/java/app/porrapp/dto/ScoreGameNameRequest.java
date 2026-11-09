package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nuevo nombre de un juego de la liga. */
public record ScoreGameNameRequest(@NotBlank @Size(max = 60) String name) {
}
