package app.porrapp.dto;

import jakarta.validation.constraints.NotNull;

/** El usuario dice cuál de los jugadores del marcador es él. */
public record ScoreTrackerClaimRequest(@NotNull Long playerId) {
}
