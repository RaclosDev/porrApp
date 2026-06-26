package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class GroupResponseDTO {
    private Long id;
    private String name;
    private String joinCode;
    private String adminParticipantName;
    private Long adminUserId;
    private LocalDateTime createdAt;
    
    // Edition specific fields (active edition)
    private String competitionName;
    private String betMode;
    private Boolean pichichi;
}
