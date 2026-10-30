package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GroupJoinDTO {
    /** Código de invitación alfanumérico. Ej: "XJ92K1" */
    @NotBlank(message = "El código es obligatorio")
    private String joinCode;
}
