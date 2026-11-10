package app.porrapp.dto;

import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/**
 * Ronda apuntada en una partida. En los juegos por puntos, {@code scores} trae los puntos de quienes la
 * jugaron: quien no aparece no jugó esa ronda (no es un 0). En los juegos por victorias, {@code winners}
 * dice quién la ganó (varios si ganó una pareja). Sin {@code sessionId}, va a la última partida.
 */
public record ScoreTrackerRoundRequest(@Size(max = 120) String note, Map<Long, Integer> scores, Long sessionId,
                                       @Size(max = 20) List<Long> winners) {
}
