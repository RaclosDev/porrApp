package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GroupUpdateDTO {
    @NotBlank(message = "El nombre del grupo no puede estar vacío")
    private String name;
}
