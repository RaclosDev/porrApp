package com.porra.mundial.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupMemberDTO {
    private Long userId;
    private String participantName;
    private String googleEmail;
    private String role;
    private String paymentStatus;
    private LocalDateTime joinedAt;
    private boolean isAdmin;
}
