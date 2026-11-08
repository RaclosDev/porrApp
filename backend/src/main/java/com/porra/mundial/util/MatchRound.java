package com.porra.mundial.util;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Sport;
import com.porra.mundial.sports.TennisTournaments;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Calendar grouping when the provider does not supply an official matchday. */
public final class MatchRound {
    private MatchRound() {}

    private static final String GROUP_PREFIX = "grupo ";
    private static final String DATE_PREFIX = "fecha ";
    private static final String NO_ROUND = "sin jornada";
    private static final String WEEK_PREFIX_LABEL = "Semana ";
    /** Rango vacío para las jornadas que no son de una fecha. */
    private static final Instant NO_DAY = Instant.EPOCH;
    /** «Jornada 13» o, en la NFL, «Semana 9». */
    private static final Pattern NUMBERED_MATCHDAY = Pattern.compile("(?i)(?:jornada|semana)\\s+(\\d{1,4})");

    /** Nombre visible de las rondas eliminatorias (las de la Champions también se juegan por jornadas). */
    private static final Map<String, String> KNOCKOUT_LABELS = Map.of(
            "playoff", "Playoff", "r32", "Dieciseisavos", "r16", "Octavos de final",
            "qf", "Cuartos de final", "sf", "Semifinales", "third", "Tercer puesto", "final", "Final",
            "roundrobin", "Fase de grupos");

    public static String label(Match match) {
        if (match.getGroupName() != null && !match.getGroupName().isBlank()) {
            return "Grupo " + match.getGroupName();
        }
        String knockout = match.getRound() == null ? null : KNOCKOUT_LABELS.get(match.getRound());
        if (knockout != null) return knockout;
        if (match.getRound() != null && !match.getRound().isBlank()
                && !"group".equalsIgnoreCase(match.getRound())) {
            return match.getRound();
        }
        return match.getMatchDate() != null ? "Fecha " + AppTime.day(match.getMatchDate()) : "Sin jornada";
    }

    /**
     * Jornada de un partido en una liga: la de su competición o, si la liga junta varias competiciones
     * (cuyas jornadas no coinciden: la «Jornada 3» de LaLiga no es la de la Champions), su semana.
     */
    public static String label(Edition edition, Match match) {
        if (edition != null && edition.getTennisScope() != null) return tennisTournamentLabel(match);
        return edition != null && edition.isMultiCompetition() && !sharedRounds(match) ? weekLabel(match) : label(match);
    }

    /**
     * Jornada de un partido en el calendario de varias competiciones: la semana, salvo en el tenis, donde
     * los dos cuadros de un torneo comparten rondas (los octavos masculinos y femeninos van juntos).
     */
    public static String multiCompetitionLabel(Match match) {
        return sharedRounds(match) ? label(match) : weekLabel(match);
    }

    /**
     * Jornada de un partido en una liga de tenis de varios torneos: el torneo, su año y la ronda
     * («Roland Garros 2027 · Octavos de final»). Los dos cuadros de un torneo comparten jornada, y la
     * misma ronda de dos torneos (o de dos años del mismo) no se mezcla.
     */
    public static String tennisTournamentLabel(Match match) {
        String round = label(match);
        if (match.getCompetition() == null || match.getMatchDate() == null) return round;
        return TennisTournaments.parse(match.getCompetition().getExternalId())
                .map(ref -> ref.tournament().name() + " " + AppTime.day(match.getMatchDate()).getYear() + " · " + round)
                .orElse(round);
    }

    private static boolean sharedRounds(Match match) {
        return match.getCompetition() != null && Sport.isTennis(match.getCompetition());
    }

    /**
     * Semana de lunes a domingo (hora peninsular) de un partido: «Semana 2026-11-02», con la fecha de su
     * lunes. No depende de qué otros partidos haya en la liga, así que no cambia al elegir partidos.
     */
    public static String weekLabel(Match match) {
        LocalDate day = AppTime.day(match.getMatchDate());
        return day == null ? "Sin jornada" : WEEK_PREFIX_LABEL + day.with(DayOfWeek.MONDAY);
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
        List<String> names = new ArrayList<>(name.startsWith(GROUP_PREFIX)
                ? List.of(name, name.substring(GROUP_PREFIX.length()))
                : List.of(name));
        KNOCKOUT_LABELS.forEach((key, label) -> {
            if (label.equalsIgnoreCase(name)) names.add(key);
        });
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

    /** Número de una jornada "Jornada N" (o "Semana N" de la NFL), o null si la etiqueta no es de ese tipo. */
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
