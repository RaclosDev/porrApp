package com.porra.mundial.dto;

/** @param remindersEnabled avisar una hora antes de que cierre un partido sin predicción */
public record PushPreferencesRequest(boolean remindersEnabled) {
}
