package app.porrapp.dto;

import jakarta.validation.constraints.Size;

import java.util.Map;

/** Partida apuntada: puntos por id de jugador (los que falten cuentan 0). */
public record ScoreTrackerRoundRequest(@Size(max = 120) String note, Map<Long, Integer> scores) {
}
