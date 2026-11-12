package app.porrapp.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeagueMemberDTO {
    private Long userId;
    private String participantName;
    private String role;
    private boolean creator;
    private String paymentStatus;
    private Instant joinedAt;
    // Lombok genera isAdmin(); sin @JsonProperty, Jackson lo publicaría como "admin".
    @JsonProperty("isAdmin")
    private boolean admin;
    /** URL (versionada) de la foto de perfil, o null si no tiene. */
    private String avatarUrl;
}
