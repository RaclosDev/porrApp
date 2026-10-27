package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO para el envío en lote de pronósticos de una o varias jornadas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchdaySubmissionDTO {

    @NotNull(message = "El identificador de liga/grupo es obligatorio")
    private Long groupId;

    @NotEmpty(message = "Debes proporcionar al menos un pronóstico")
    private List<@Valid MatchPredictionItemDTO> predictions;
}
