package com.porra.mundial.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/** Los campos nulos no se modifican. */
@Data
public class GroupUpdateDTO {
    /** Nuevo nombre del grupo. Si se omite, no se modifica. */
    @Size(max = 120, message = "El nombre de la liga es demasiado largo")
    private String name;

    /** Reglas personalizadas de la liga. Si se omite, no se modifican. */
    @Size(max = 8000, message = "Las reglas son demasiado largas")
    private String rules;
}
