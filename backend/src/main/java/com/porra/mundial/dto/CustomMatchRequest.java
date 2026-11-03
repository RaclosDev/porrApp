package com.porra.mundial.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record CustomMatchRequest(@NotNull Long homeTeamId, Long awayTeamId,
                                 LocalDateTime matchDate, String round) {
    public CustomMatchRequest(Long homeTeamId, Long awayTeamId, LocalDateTime matchDate) {
        this(homeTeamId, awayTeamId, matchDate, null);
    }
}
