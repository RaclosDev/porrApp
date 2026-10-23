package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.AssertTrue;
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
    
    /** Formato o modalidad de la porra (acepta betMode o poolFormat). */
    @JsonAlias("poolFormat")
    private String betMode;

    /** Campo explícito para clientes que envían poolFormat. */
    private String poolFormat;
    
    /** Indica si el grupo tendrá premio o clasificación específica para el Pichichi. */
    private Boolean pichichi = true;

    @AssertTrue(message = "El formato de porra (poolFormat o betMode) es obligatorio")
    public boolean isValidFormat() {
        return (betMode != null && !betMode.isBlank()) || (poolFormat != null && !poolFormat.isBlank());
    }

    public String resolveFormat() {
        if (poolFormat != null && !poolFormat.isBlank()) {
            return poolFormat;
        }
        return betMode;
    }
}
