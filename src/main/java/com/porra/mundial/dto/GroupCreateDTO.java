package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GroupCreateDTO {
    
    @NotBlank(message = "El nombre del grupo es obligatorio")
    private String name;
    
    @NotNull(message = "Competición es obligatoria")
    private Long competitionId;
    
    @NotBlank(message = "Tipo de porra es obligatorio")
    private String betMode;
    
    private Boolean pichichi = true;
}
