package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO para la solicitud de unirse a un Grupo existente mediante código.
 */
@Data
public class GroupJoinDTO {
    /** Código de invitación alfanumérico. Ej: "XJ92K1" */
    @NotBlank(message = "El código es obligatorio")
    private String joinCode;
}
