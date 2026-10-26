package com.porra.mundial.dto;

import com.porra.mundial.model.MatchStatusNormalized;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para la corrección o introducción manual de resultados por parte de un administrador.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualMatchOverrideDTO {
    @NotNull(message = "El marcador local es obligatorio")
    @Min(value = 0, message = "Los goles no pueden ser negativos")
    private Integer homeScore;

    @NotNull(message = "El marcador visitante es obligatorio")
    @Min(value = 0, message = "Los goles no pueden ser negativos")
    private Integer awayScore;

    private Integer homeFairPlay;
    private Integer awayFairPlay;

    private MatchStatusNormalized status;
}
