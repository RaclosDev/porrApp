package app.porrapp.dto;

import jakarta.validation.constraints.NotNull;

/** El jugador en el que se juntan las partidas de otro que era la misma persona. */
public record ScorePlayerMergeRequest(@NotNull Long intoPlayerId) {
}
