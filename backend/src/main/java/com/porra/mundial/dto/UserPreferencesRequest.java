package com.porra.mundial.dto;

/**
 * Preferencias de interfaz que se recuerdan entre dispositivos.
 *
 * @param lastSelectedGroupId última liga abierta; null la olvida
 */
public record UserPreferencesRequest(Long lastSelectedGroupId) {
}
