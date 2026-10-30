package com.porra.mundial.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
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
    // Sin @JsonProperty, Lombok genera isAdmin() y Jackson lo publicaría como "admin".
    @JsonProperty("isAdmin")
    private boolean isAdmin;
    /** URL (versionada) de la foto de perfil, o null si no tiene. */
    private String avatarUrl;
}
