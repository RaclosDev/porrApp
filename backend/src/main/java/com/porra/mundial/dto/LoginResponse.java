package com.porra.mundial.dto;

/**
 * Sesión iniciada con Google. El refresh token no va aquí: va en su cookie HttpOnly.
 *
 * @param token               access token (JWT de 15 minutos)
 * @param userId              id del usuario
 * @param participantName     apodo en la porra
 * @param status              siempre "login_success"
 * @param lastSelectedGroupId última liga abierta, o -1 si no hay
 * @param avatarUrl           foto de perfil, o cadena vacía
 */
public record LoginResponse(String token, Long userId, String participantName, String status,
                            Long lastSelectedGroupId, String avatarUrl) {
}
