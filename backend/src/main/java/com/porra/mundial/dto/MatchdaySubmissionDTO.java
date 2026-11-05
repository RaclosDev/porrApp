package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchdaySubmissionDTO {

    @NotNull(message = "Falta la liga")
    private Long groupId;

    @NotEmpty(message = "Debes enviar al menos una predicción")
    // Una jornada tiene unos pocos partidos; el tope solo frena peticiones desmesuradas.
    @Size(max = 200, message = "Demasiadas predicciones en una sola petición")
    private List<@Valid MatchPredictionItemDTO> predictions;
}
