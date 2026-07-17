package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO para la solicitud de actualización de los datos de un Grupo existente.
 * Actualmente solo se permite renombrar el grupo.
 */
@Data
public class GroupUpdateDTO {
    /** Nuevo nombre del grupo. */
    @NotBlank(message = "El nombre del grupo no puede estar vacío")
    private String name;
}
