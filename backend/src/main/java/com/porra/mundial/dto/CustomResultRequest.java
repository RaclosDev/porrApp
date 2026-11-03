package com.porra.mundial.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CustomResultRequest(@NotNull @Min(0) Integer homeScore,
                                  @NotNull @Min(0) Integer awayScore) {}
