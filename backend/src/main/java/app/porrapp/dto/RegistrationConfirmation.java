package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Código del correo y la misma contraseña, para terminar de crear la cuenta. */
public record RegistrationConfirmation(
        @NotBlank(message = "Escribe tu email") @Size(max = 254, message = "El email es demasiado largo") String email,
        @NotBlank(message = "Escribe el código") @Size(max = 12, message = "El código tiene 6 cifras") String code,
        @NotBlank(message = "Escribe tu contraseña") @Size(max = 200, message = "La contraseña es demasiado larga")
        String password) {

    /** Que la contraseña ni el código acaben en los logs. */
    @Override
    public String toString() {
        return "RegistrationConfirmation[email=" + email + "]";
    }
}
