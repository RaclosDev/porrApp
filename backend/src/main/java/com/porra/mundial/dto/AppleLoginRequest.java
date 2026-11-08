package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param idToken ID token que devuelve «Iniciar sesión con Apple»
 * @param name    nombre de la persona, que Apple solo da la primera vez; null las demás
 */
public record AppleLoginRequest(
        @NotBlank(message = "Falta la credencial de Apple") @Size(max = 8000) String idToken,
        @Size(max = 100) String name) {
}
