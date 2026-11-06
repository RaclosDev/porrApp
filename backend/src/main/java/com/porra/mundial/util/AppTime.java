package com.porra.mundial.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Las fechas se guardan como instantes ({@code timestamptz}). La hora peninsular solo interviene
 * en los bordes: lo que escribe un administrador sin desfase, los días de una jornada y la salida
 * de la API, que lleva el desfase de Madrid ({@code 2026-06-11T21:00:00+02:00}).
 */
public final class AppTime {

    public static final ZoneId ZONE = ZoneId.of("Europe/Madrid");

    private AppTime() {
    }

    /** Hora peninsular sin desfase (la de un formulario) a instante. */
    public static Instant fromLocal(LocalDateTime local) {
        return local == null ? null : local.atZone(ZONE).toInstant();
    }

    /** Instante a hora peninsular sin desfase. */
    public static LocalDateTime toLocal(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZONE);
    }

    /** Día peninsular del instante. */
    public static LocalDate day(Instant instant) {
        return instant == null ? null : LocalDate.ofInstant(instant, ZONE);
    }

    /** Primer instante del día peninsular. */
    public static Instant startOfDay(LocalDate day) {
        return day.atStartOfDay(ZONE).toInstant();
    }

    /** Formato de la API: ISO con el desfase de Madrid. */
    public static String format(Instant instant) {
        return instant == null ? null : instant.atZone(ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
