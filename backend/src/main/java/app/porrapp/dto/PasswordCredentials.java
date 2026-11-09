package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Email y contraseña para registrarse o iniciar sesión sin Google. */
public record PasswordCredentials(
        @NotBlank(message = "Escribe tu email") @Size(max = 254, message = "El email es demasiado largo") String email,
        @NotBlank(message = "Escribe tu contraseña") @Size(max = 200, message = "La contraseña es demasiado larga")
        String password) {

    /** Que la contraseña no acabe en los logs si alguien imprime la petición. */
    @Override
    public String toString() {
        return "PasswordCredentials[email=" + email + "]";
    }
}
