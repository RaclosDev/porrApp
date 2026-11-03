package com.porra.mundial.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record CustomMatchRequest(@NotNull Long homeTeamId, @NotNull Long awayTeamId,
                                 @NotNull LocalDateTime matchDate) {}
