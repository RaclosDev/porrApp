package app.porrapp.util;

import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.Objects;

/**
 * Aplazados que vuelven con fecha nueva lejos del resto de su jornada (el Rayo-Athletic de la jornada 8
 * jugado en diciembre). No retienen la jornada en curso: van con la jornada en la que se juegan.
 */
public final class LateMatches {
    private LateMatches() {}

    /** Más de una semana: así ni una semana de la NBA ni una jornada de jueves a lunes dejan rezagados. */
    static final Duration GAP = Duration.ofDays(7);

    /** Partido que aún se jugará: ni terminado ni cancelado, aplazado, abandonado o suspendido. */
    public static boolean isStillToPlay(Match match) {
        MatchStatusNormalized status = match.getStatus();
        return !Boolean.TRUE.equals(match.getFinished())
                && status != MatchStatusNormalized.CANCELLED && status != MatchStatusNormalized.POSTPONED
                && status != MatchStatusNormalized.ABANDONED && status != MatchStatusNormalized.SUSPENDED;
    }

    /** Partido por jugar que cae más de una semana después del último ya jugado de su jornada. */
    public static boolean isLate(Match match, Collection<Match> round) {
        if (!isStillToPlay(match) || match.getMatchDate() == null) return false;
        Instant lastPlayed = round.stream()
                .filter(other -> Boolean.TRUE.equals(other.getFinished()))
                .map(Match::getMatchDate)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return lastPlayed != null && Duration.between(lastPlayed, match.getMatchDate()).compareTo(GAP) > 0;
    }

    /** La jornada tiene algún partido por jugar en su fecha, sin contar sus aplazados. */
    public static boolean hasOnTimeMatchToPlay(Collection<Match> round) {
        return round.stream().anyMatch(match -> isStillToPlay(match) && !isLate(match, round));
    }
}
