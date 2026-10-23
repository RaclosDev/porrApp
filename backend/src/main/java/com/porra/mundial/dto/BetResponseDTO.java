package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO de respuesta para representar pronosticos hacia el frontend.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BetResponseDTO {
    private String key;
    private String hash;
    private Boolean paid;
    private String participantName;
    private Long userId;
    private String betName;
    private Long groupId;
    private BetDataDTO data;

    public String getPredictionName() {
        return betName;
    }

    public void setPredictionName(String predictionName) {
        this.betName = predictionName;
    }
}
