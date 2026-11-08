package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Token del enlace del correo y contraseña nueva. */
public record PasswordReset(
        @NotBlank(message = "Falta el enlace") @Size(max = 100, message = "Enlace no válido") String token,
        @NotBlank(message = "Escribe tu contraseña") @Size(max = 200, message = "La contraseña es demasiado larga")
        String password) {

    /** Que ni el token ni la contraseña acaben en los logs. */
    @Override
    public String toString() {
        return "PasswordReset[]";
    }
}
