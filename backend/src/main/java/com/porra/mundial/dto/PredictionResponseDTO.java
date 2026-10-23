package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para transferir la informacion de un Pronostico (Prediction) a las capas cliente.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionResponseDTO {
    private String key;
    private String hash;
    private Boolean paid;
    private String participantName;
    private Long userId;
    private String predictionName;
    private Long groupId;
    private PredictionDataDTO data;

    public String getBetName() {
        return predictionName;
    }

    public void setBetName(String betName) {
        this.predictionName = betName;
    }
}
