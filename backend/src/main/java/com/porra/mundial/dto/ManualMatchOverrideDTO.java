package com.porra.mundial.dto;

import com.porra.mundial.model.MatchStatusNormalized;
import jakarta.validation.constraints.NotNull;
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
    private Integer homeScore;

    @NotNull(message = "El marcador visitante es obligatorio")
    private Integer awayScore;

    private Integer homeFairPlay;
    private Integer awayFairPlay;

    private MatchStatusNormalized status;
}
