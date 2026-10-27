package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Solicitud para modificar el perfil público del usuario autenticado.
 * Solo incluye el nombre visible: el email y el nombre de Google nunca se pueden cambiar desde aquí.
 */
@Data
public class ProfileUpdateDTO {

    @NotBlank(message = "El nombre es obligatorio.")
    @Size(max = 60, message = "El nombre es demasiado largo.")
    private String participantName;
}
