package com.porra.mundial.dto;

/**
 * Datos del usuario autenticado que la SPA necesita al arrancar.
 *
 * @param userId              id del usuario (semilla de su avatar generado, entre otros)
 * @param participantName     apodo en la porra
 * @param lastSelectedGroupId última liga que tenía abierta
 * @param avatarUrl           foto de perfil versionada, o null
 */
public record MeResponse(Long userId, String participantName, Long lastSelectedGroupId, String avatarUrl) {
}
