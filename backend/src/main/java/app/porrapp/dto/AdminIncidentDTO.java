package app.porrapp.dto;

import java.time.Instant;

/**
 * Un cambio de resultado que la sincronización ha retenido para que lo revise el administrador.
 *
 * @param kind        REGRESSION (un partido terminado que vuelve atrás), SCORE_CHANGE (otro marcador final)
 *                    o FIGHT_MISSING (una pelea que ya no sale en la cartelera)
 * @param status      BLOCKED y PENDING están abiertas; APPLIED y DISMISSED, resueltas
 * @param autoApplyAt cuándo se aplica sola si el proveedor lo sigue confirmando; null si no se aplica sola
 * @param resolvedBy  "auto" o "admin"
 */
public record AdminIncidentDTO(
        Long id,
        String kind,
        String status,
        Long matchId,
        String match,
        String competition,
        Instant matchDate,
        Side previous,
        Side received,
        Instant firstSeenAt,
        Instant lastSeenAt,
        int seenCount,
        Instant autoApplyAt,
        Instant resolvedAt,
        String resolvedBy) {

    /** Estado, marcador y ganador, con el estado ya en texto. */
    public record Side(String status, Integer homeScore, Integer awayScore, String winner) {
    }
}
