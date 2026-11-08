package com.porra.mundial.model;

import java.util.regex.Pattern;

/**
 * Qué veladas de la UFC sigue una liga con todas las veladas: las grandes (las numeradas, «UFC 334: …», y
 * los eventos especiales como «UFC Freedom 250») o solo las Fight Night («UFC Fight Night», «Noche UFC»,
 * «UFC on ABC», «UFC Vegas»). Sin valor, todas.
 */
public enum EventSeries {
    NUMBERED,
    FIGHT_NIGHT;

    /**
     * Nombres de las Fight Night: «UFC Fight Night: …», «Noche UFC: …» (ESPN en español), las de la tele
     * («UFC on ABC 9», «UFC on ESPN 60») y las del Apex con el nombre de la ciudad («UFC Vegas 105»).
     */
    private static final Pattern FIGHT_NIGHT_EVENT = Pattern.compile(
            "^(UFC\\s+Fight\\s+Night|Noche\\s+UFC|UFC\\s+on\\s|UFC\\s+Vegas\\b|UFC\\s+Apex\\b).*",
            Pattern.CASE_INSENSITIVE);

    /**
     * De qué serie es una velada por su nombre (la ronda de sus peleas); null si no tiene nombre. Lo que no
     * es una Fight Night va con las numeradas: un evento especial como «UFC Freedom 250» lleva peleas por
     * el título, como una numerada.
     */
    public static EventSeries of(String eventName) {
        if (eventName == null || eventName.isBlank()) return null;
        return FIGHT_NIGHT_EVENT.matcher(eventName.trim()).matches() ? FIGHT_NIGHT : NUMBERED;
    }

    /** Si la velada de ese nombre entra en una liga que sigue {@code series} (null: todas). */
    public static boolean includes(EventSeries series, String eventName) {
        return series == null || of(eventName) == series;
    }
}
