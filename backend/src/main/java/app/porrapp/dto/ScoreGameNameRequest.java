package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nuevo nombre de un juego de la liga y, si llega, su unidad (puntos, bazas…). */
public record ScoreGameNameRequest(@NotBlank @Size(max = 60) String name, @Size(max = 30) String unit) {

    public ScoreGameNameRequest(String name) {
        this(name, null);
    }
}
