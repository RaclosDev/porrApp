package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Email al que mandar el enlace para cambiar la contraseña. */
public record PasswordResetRequest(
        @NotBlank(message = "Escribe tu email") @Size(max = 254, message = "El email es demasiado largo") String email) {
}
