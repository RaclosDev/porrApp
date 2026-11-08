package com.porra.mundial.model;

import java.util.regex.Pattern;

/**
 * Qué veladas de la UFC sigue una liga con todas las veladas: solo las numeradas («UFC 334: …») o solo
 * las demás (las Fight Night, «Noche UFC» y otras sin número). Sin valor, todas.
 */
public enum EventSeries {
    NUMBERED,
    FIGHT_NIGHT;

    /** «UFC 334: Gane vs. Hokit»: el nombre empieza por UFC y el número de la velada. */
    private static final Pattern NUMBERED_EVENT = Pattern.compile("^UFC\\s+\\d+\\b.*", Pattern.CASE_INSENSITIVE);

    /** De qué serie es una velada por su nombre (la ronda de sus peleas); null si no tiene nombre. */
    public static EventSeries of(String eventName) {
        if (eventName == null || eventName.isBlank()) return null;
        return NUMBERED_EVENT.matcher(eventName.trim()).matches() ? NUMBERED : FIGHT_NIGHT;
    }

    /** Si la velada de ese nombre entra en una liga que sigue {@code series} (null: todas). */
    public static boolean includes(EventSeries series, String eventName) {
        return series == null || of(eventName) == series;
    }
}
