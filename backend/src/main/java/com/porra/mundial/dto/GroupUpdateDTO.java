package com.porra.mundial.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO para la solicitud de actualización de los datos de un Grupo existente.
 * Permite renombrar el grupo y/o modificar sus reglas personalizadas.
 */
@Data
public class GroupUpdateDTO {
    /** Nuevo nombre del grupo. Si se omite, no se modifica. */
    @Size(max = 120, message = "El nombre del grupo es demasiado largo")
    private String name;

    /** Reglas personalizadas de la liga. Si se omite, no se modifican. */
    @Size(max = 8000, message = "Las reglas son demasiado largas")
    private String rules;
}
