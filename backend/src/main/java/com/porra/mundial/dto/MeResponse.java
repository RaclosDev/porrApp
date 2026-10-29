package com.porra.mundial.dto;

/**
 * Datos del usuario autenticado que la SPA necesita al arrancar.
 *
 * @param participantName     apodo en la porra
 * @param lastSelectedGroupId última liga que tenía abierta
 * @param avatarUrl           foto de perfil versionada, o null
 */
public record MeResponse(String participantName, Long lastSelectedGroupId, String avatarUrl) {
}
