package com.porra.mundial.dto;

/**
 * Lo que la SPA necesita para ofrecer los avisos push.
 *
 * @param publicKey           clave pública VAPID en base64url; null si el servidor no tiene avisos configurados
 * @param remindersEnabled    si el usuario quiere recordatorios de predicciones pendientes
 * @param memberJoinedEnabled si el usuario quiere saber cuándo se une alguien a sus ligas
 */
public record PushConfigResponse(String publicKey, boolean remindersEnabled, boolean memberJoinedEnabled) {
}
