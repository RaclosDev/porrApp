package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LeagueJoinDTO {
    /** Código de invitación alfanumérico. Ej: "XJ92K1" */
    @NotBlank(message = "El código es obligatorio")
    private String joinCode;
}
