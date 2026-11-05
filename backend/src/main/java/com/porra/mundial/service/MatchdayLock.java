package com.porra.mundial.service;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.util.MatchRound;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Cuándo se cierra cada partido de una liga por jornadas: al empezar el propio partido, al empezar el
 * primer partido de su día o al empezar el primero de su jornada; siempre menos el margen elegido.
 */
public final class MatchdayLock {
    private MatchdayLock() {}

    /** Modo efectivo: las ligas creadas antes de poder elegir cierran partido a partido. */
    public static PredictionLockMode mode(Edition edition) {
        PredictionLockMode mode = edition == null ? null : edition.getLockMode();
        return mode == PredictionLockMode.PER_DAY || mode == PredictionLockMode.PER_ROUND
                ? mode : PredictionLockMode.PER_MATCH;
    }

    /** Si el cierre de un partido depende de otros (su día o su jornada). */
    public static boolean needsWholeCalendar(Edition edition) {
        return mode(edition) != PredictionLockMode.PER_MATCH;
    }

    /**
     * Cierre de cada partido de {@code matches}; los que no tienen fecha no aparecen.
     *
     * @param calendar todos los partidos de la competición si el modo agrupa partidos; si no, basta con
     *                 los mismos {@code matches}
     */
    public static Map<Long, LocalDateTime> lockTimes(Edition edition, List<Match> matches, List<Match> calendar) {
        PredictionLockMode mode = mode(edition);
        int offset = edition == null ? 0 : Math.max(0, edition.getLockOffsetMinutes());
        Function<Match, Object> key = switch (mode) {
            case PER_DAY -> match -> match.getMatchDate().toLocalDate();
            case PER_ROUND -> MatchRound::label;
            default -> Match::getId;
        };
        Map<Object, LocalDateTime> first = new HashMap<>();
        for (Match match : mode == PredictionLockMode.PER_MATCH ? matches : calendar) {
            if (match.getMatchDate() == null) continue;
            first.merge(key.apply(match), match.getMatchDate(), (left, right) -> left.isBefore(right) ? left : right);
        }
        Map<Long, LocalDateTime> locks = new HashMap<>();
        for (Match match : matches) {
            if (match.getMatchDate() == null || match.getId() == null) continue;
            LocalDateTime start = first.getOrDefault(key.apply(match), match.getMatchDate());
            // Un partido adelantado nunca se cierra después de empezar.
            if (match.getMatchDate().isBefore(start)) start = match.getMatchDate();
            locks.put(match.getId(), start.minusMinutes(offset));
        }
        return locks;
    }

    /** Motivo del cierre de un partido cuyo plazo ya ha pasado. */
    public static String reason(Edition edition, Match match, LocalDateTime now) {
        if (match.getMatchDate() != null && !match.getMatchDate().isAfter(now)) return "El partido ya ha comenzado";
        return switch (mode(edition)) {
            case PER_DAY -> "Los pronósticos de este día ya están cerrados";
            case PER_ROUND -> "Los pronósticos de esta jornada ya están cerrados";
            default -> "El plazo para pronosticar este partido ha terminado";
        };
    }
}
