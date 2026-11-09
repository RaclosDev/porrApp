package app.porrapp.dto;

/**
 * Lo que la SPA necesita para ofrecer los avisos push.
 *
 * @param publicKey           clave pública VAPID en base64url; null si el servidor no tiene avisos configurados
 * @param remindersEnabled    si el usuario quiere recordatorios de predicciones pendientes
 * @param memberJoinedEnabled si el usuario quiere saber cuándo se une alguien a sus ligas
 * @param matchdayFinishedEnabled si el usuario quiere saber cuándo termina una jornada de sus ligas
 */
public record PushConfigResponse(String publicKey, boolean remindersEnabled, boolean memberJoinedEnabled,
                                 boolean matchdayFinishedEnabled) {
}
