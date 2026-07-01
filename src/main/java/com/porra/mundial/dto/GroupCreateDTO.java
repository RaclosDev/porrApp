package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * DTO para la solicitud de creación de un nuevo Grupo (Liga Privada).
 */
@Data
public class GroupCreateDTO {
    
    /** Nombre visible del grupo. Ej: "Los Amigos del Barrio" */
    @NotBlank(message = "El nombre del grupo es obligatorio")
    private String name;
    
    /** ID de la competición (Mundial, Eurocopa) a la que está vinculado el grupo. */
    @NotNull(message = "Competición es obligatoria")
    private Long competitionId;
    
    /** Modalidad de apuesta: TRADITIONAL o ADVANCED. */
    @NotBlank(message = "Tipo de porra es obligatorio")
    private String betMode;
    
    /** Indica si el grupo tendrá premio o clasificación específica para el Pichichi. */
    private Boolean pichichi = true;
}
