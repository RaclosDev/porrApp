package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para enviar un pronóstico individual de un partido (marcador o 1X2).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchPredictionItemDTO {

    @NotNull(message = "El ID del partido es obligatorio")
    private Long matchId;

    private Integer homeScore;

    private Integer awayScore;

    private String sign; // "1", "X", "2"
}
