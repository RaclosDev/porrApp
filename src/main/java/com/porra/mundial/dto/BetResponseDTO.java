package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BetResponseDTO {
    private String key;
    private String hash;
    private Boolean paid;
    private String participantName;
    private Long userId;
    private String betName;
    private Long groupId;
    private BetDataDTO data;
}
