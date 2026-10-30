package com.porra.mundial.dto;

/**
 * Sesión iniciada con Google.
 *
 * @param token               JWT de la aplicación
 * @param userId              id del usuario
 * @param participantName     apodo en la porra
 * @param status              siempre "login_success"
 * @param lastSelectedGroupId última liga abierta, o -1 si no hay
 * @param avatarUrl           foto de perfil, o cadena vacía
 */
public record LoginResponse(String token, Long userId, String participantName, String status,
                            Long lastSelectedGroupId, String avatarUrl) {
}
