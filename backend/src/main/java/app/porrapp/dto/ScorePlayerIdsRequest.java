package app.porrapp.dto;

import jakarta.validation.constraints.Size;

import java.util.List;

/** Quiénes están: los asistentes de un día de juego o los participantes de una partida. */
public record ScorePlayerIdsRequest(@Size(max = 20) List<Long> playerIds) {
}
