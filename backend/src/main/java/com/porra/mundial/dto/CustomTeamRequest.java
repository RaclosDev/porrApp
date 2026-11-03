package com.porra.mundial.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomTeamRequest(@NotBlank @Size(max = 100) String name) {}
