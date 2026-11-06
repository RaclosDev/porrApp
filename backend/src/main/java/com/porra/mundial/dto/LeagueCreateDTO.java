package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LeagueCreateDTO {
    
    /** Nombre visible del grupo. Ej: "Los Amigos del Barrio" */
    @NotBlank(message = "El nombre de la liga es obligatorio")
    private String name;
    
    /** ID de la competición (Mundial, Eurocopa) a la que está vinculado el grupo. */
    private Long competitionId;

    /** Nombre de una competición manual exclusiva de esta liga. */
    private String customCompetitionName;
    
    /** Formato o modalidad de la porra (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY). */
    @NotBlank(message = "El formato de la porra es obligatorio")
    private String poolFormat;
    
    /** Indica si el grupo tendrá premio o clasificación específica para el Pichichi. */
    private Boolean pichichi = true;
}
