package com.porra.mundial.util;

import com.porra.mundial.model.Match;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Calendar grouping when the provider does not supply an official matchday. */
public final class MatchRound {
    private MatchRound() {}

    private static final String GROUP_PREFIX = "grupo ";
    private static final String DATE_PREFIX = "fecha ";
    private static final String NO_ROUND = "sin jornada";
    /** Rango vacío para las jornadas que no son de una fecha. */
    private static final Instant NO_DAY = Instant.EPOCH;
    private static final Pattern NUMBERED_MATCHDAY = Pattern.compile("(?i)jornada\\s+(\\d{1,4})");

    public static String label(Match match) {
        if (match.getGroupName() != null && !match.getGroupName().isBlank()) {
            return "Grupo " + match.getGroupName();
        }
        if (match.getRound() != null && !match.getRound().isBlank()
                && !"group".equalsIgnoreCase(match.getRound())) {
            return match.getRound();
        }
        return match.getMatchDate() != null ? "Fecha " + AppTime.day(match.getMatchDate()) : "Sin jornada";
    }

    public static boolean matches(Match match, String round) {
        return round != null && (round.equalsIgnoreCase(label(match))
                || round.equalsIgnoreCase(match.getRound())
                || round.equalsIgnoreCase(match.getGroupName()));
    }

    /**
     * Criterios de base de datos para una jornada: devuelven todos los partidos que cumplen
     * {@link #matches} (y quizá alguno más, que el filtro en Java descarta).
     *
     * @param names     ronda o grupo, en minúsculas ("jornada 3", o "a" para "Grupo A")
     * @param dayStart  inicio del día de una jornada "Fecha AAAA-MM-DD"; rango vacío si no lo es
     * @param undated   si la jornada es "Sin jornada" (partidos sin fecha)
     */
    public record Lookup(List<String> names, Instant dayStart, Instant dayEnd, boolean undated) {}

    public static Lookup lookup(String round) {
        String name = round.trim().toLowerCase(Locale.ROOT);
        List<String> names = name.startsWith(GROUP_PREFIX)
                ? List.of(name, name.substring(GROUP_PREFIX.length()))
                : List.of(name);
        LocalDate day = null;
        if (name.startsWith(DATE_PREFIX)) {
            try {
                day = LocalDate.parse(name.substring(DATE_PREFIX.length()).trim());
            } catch (DateTimeParseException ignored) {
                // No es una fecha: se busca solo por nombre.
            }
        }
        return new Lookup(names,
                day != null ? AppTime.startOfDay(day) : NO_DAY,
                day != null ? AppTime.startOfDay(day.plusDays(1)) : NO_DAY,
                NO_ROUND.equals(name));
    }

    /** Número de una jornada "Jornada N", o null si la etiqueta no es de ese tipo. */
    public static Integer matchdayNumber(String label) {
        if (label == null) return null;
        Matcher m = NUMBERED_MATCHDAY.matcher(label.trim());
        return m.matches() ? Integer.valueOf(m.group(1)) : null;
    }

    /**
     * Ordena por número las jornadas "Jornada N" (un aplazado no adelanta una jornada a otra)
     * sin mover de su sitio las demás etiquetas, como las rondas de eliminatoria.
     */
    public static <T> void sortNumberedMatchdays(List<T> items, Function<T, String> label) {
        List<Integer> slots = new ArrayList<>();
        List<T> numbered = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            if (matchdayNumber(label.apply(items.get(i))) != null) {
                slots.add(i);
                numbered.add(items.get(i));
            }
        }
        numbered.sort(Comparator.comparing(item -> matchdayNumber(label.apply(item))));
        for (int i = 0; i < slots.size(); i++) {
            items.set(slots.get(i), numbered.get(i));
        }
    }
}
