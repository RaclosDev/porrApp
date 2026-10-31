package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchPredictionItemDTO {

    @NotNull(message = "El ID del partido es obligatorio")
    private Long matchId;

    @Min(value = 0, message = "Los goles no pueden ser negativos")
    private Integer homeScore;

    @Min(value = 0, message = "Los goles no pueden ser negativos")
    private Integer awayScore;

    private String sign; // "1", "X", "2"
}
