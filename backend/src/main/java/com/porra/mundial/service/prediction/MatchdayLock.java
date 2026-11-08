package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.util.AppTime;
import com.porra.mundial.util.MatchRound;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
     * @param calendar todos los partidos de la liga (su competición o los elegidos) si el modo agrupa
     *                 partidos; si no, basta con
     *                 los mismos {@code matches}
     */
    public static Map<Long, Instant> lockTimes(Edition edition, List<Match> matches, List<Match> calendar) {
        PredictionLockMode mode = mode(edition);
        int offset = edition == null ? 0 : Math.max(0, edition.getLockOffsetMinutes());
        Function<Match, Object> key = groupKey(edition);
        Map<Object, Instant> first = new HashMap<>();
        for (Match match : mode == PredictionLockMode.PER_MATCH ? matches : calendar) {
            if (match.getMatchDate() == null) continue;
            first.merge(key.apply(match), match.getMatchDate(), (left, right) -> left.isBefore(right) ? left : right);
        }
        Map<Long, Instant> locks = new HashMap<>();
        for (Match match : matches) {
            if (match.getMatchDate() == null || match.getId() == null) continue;
            Instant start = first.getOrDefault(key.apply(match), match.getMatchDate());
            // Un partido adelantado nunca se cierra después de empezar.
            if (match.getMatchDate().isBefore(start)) start = match.getMatchDate();
            locks.put(match.getId(), start.minus(offset, ChronoUnit.MINUTES));
        }
        return locks;
    }

    /**
     * Grupo de partidos que se cierran juntos: el mismo partido, el mismo día o la misma jornada (la de
     * la liga: en una que junta varias competiciones, la semana).
     */
    public static Function<Match, Object> groupKey(Edition edition) {
        return switch (mode(edition)) {
            case PER_DAY -> match -> AppTime.day(match.getMatchDate());
            case PER_ROUND -> match -> MatchRound.label(edition, match);
            default -> Match::getId;
        };
    }

    /** Motivo del cierre de un partido cuyo plazo ya ha pasado. */
    public static String reason(Edition edition, Match match, Instant now) {
        if (match.getMatchDate() != null && !match.getMatchDate().isAfter(now)) return "El partido ya ha comenzado";
        return switch (mode(edition)) {
            case PER_DAY -> "Las predicciones de este día ya están cerradas";
            case PER_ROUND -> edition != null && edition.isMultiCompetition()
                    && !com.porra.mundial.model.Sport.isTennis(edition.getCompetition())
                    ? "Las predicciones de esta semana ya están cerradas"
                    : "Las predicciones de esta jornada ya están cerradas";
            default -> "El plazo de predicción de este partido ha terminado";
        };
    }
}
