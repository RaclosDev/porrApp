package com.porra.mundial.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CustomResultRequest(@NotNull @Min(0) @Max(99) Integer homeScore,
                                  @NotNull @Min(0) @Max(99) Integer awayScore,
                                  Long winnerTeamId) {
    public CustomResultRequest(Integer homeScore, Integer awayScore) {
        this(homeScore, awayScore, null);
    }
}
