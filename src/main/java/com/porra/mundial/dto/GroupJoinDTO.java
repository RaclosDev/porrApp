package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GroupJoinDTO {
    @NotBlank(message = "El código es obligatorio")
    private String joinCode;
}
