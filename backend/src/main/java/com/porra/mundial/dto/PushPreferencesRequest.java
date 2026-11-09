package com.porra.mundial.dto;

/**
 * Preferencias de avisos; las que llegan a null no cambian.
 *
 * @param remindersEnabled    avisar una hora antes de que cierre un partido sin predicción
 * @param memberJoinedEnabled avisar cuando alguien se une a una de sus ligas
 * @param matchdayFinishedEnabled avisar cuando termina una jornada de una de sus ligas
 */
public record PushPreferencesRequest(Boolean remindersEnabled, Boolean memberJoinedEnabled,
                                     Boolean matchdayFinishedEnabled) {
}
