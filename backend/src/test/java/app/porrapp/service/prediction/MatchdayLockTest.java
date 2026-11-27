package app.porrapp.service.prediction;

import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatchdayLockTest {
    private final Instant saturday = AppTime.fromLocal(LocalDateTime.of(2026, 11, 7, 14, 0));
    private final Match first = match(1, "Jornada 12", saturday);
    private final Match late = match(2, "Jornada 12", saturday.plus(7, ChronoUnit.HOURS));
    private final Match sunday = match(3, "Jornada 12", saturday.plus(1, ChronoUnit.DAYS));
    private final Match nextRound = match(4, "Jornada 13", saturday.plus(5, ChronoUnit.HOURS));
    private final List<Match> calendar = List.of(first, late, sunday, nextRound);

    private static Match match(long id, String round, Instant date) {
        return Match.builder().id(id).round(round).matchDate(date).build();
    }

    private static Edition edition(PredictionLockMode mode, int offset) {
        return Edition.builder().poolFormat(PoolFormat.MATCH_DAY).lockMode(mode).lockOffsetMinutes(offset).build();
    }

    @Test
    void legacyLeaguesStillLockEachMatchAtKickOff() {
        Map<Long, Instant> locks = MatchdayLock.lockTimes(edition(PredictionLockMode.FIXED_DATE, 0), calendar, calendar);
        assertEquals(late.getMatchDate(), locks.get(2L));
        assertEquals(PredictionLockMode.PER_MATCH, MatchdayLock.mode(edition(PredictionLockMode.FIXED_DATE, 0)));
    }

    @Test
    void perMatchSubtractsTheMargin() {
        Map<Long, Instant> locks = MatchdayLock.lockTimes(edition(PredictionLockMode.PER_MATCH, 60), calendar, calendar);
        assertEquals(late.getMatchDate().minus(1, ChronoUnit.HOURS), locks.get(2L));
    }

    @Test
    void perDayLocksEveryMatchOfTheDayWithTheFirstOne() {
        Map<Long, Instant> locks = MatchdayLock.lockTimes(edition(PredictionLockMode.PER_DAY, 1440), calendar, calendar);
        assertEquals(saturday.minus(1, ChronoUnit.DAYS), locks.get(2L));
        assertEquals(saturday.minus(1, ChronoUnit.DAYS), locks.get(4L));
        assertEquals(saturday, locks.get(3L));
    }

    @Test
    void perRoundLocksTheWholeJornadaWithItsFirstMatch() {
        Map<Long, Instant> locks = MatchdayLock.lockTimes(edition(PredictionLockMode.PER_ROUND, 60),
                List.of(sunday, nextRound), calendar);
        assertEquals(saturday.minus(1, ChronoUnit.HOURS), locks.get(3L));
        assertEquals(nextRound.getMatchDate().minus(1, ChronoUnit.HOURS), locks.get(4L));
    }

    @Test
    void multiCompetitionLeaguesLockTheWholeWeekWithItsFirstMatch() {
        Edition weekly = edition(PredictionLockMode.PER_ROUND, 0);
        weekly.setMultiCompetition(true);
        // Otra competición, otra jornada: en la misma semana se cierra con el primero; el lunes, aparte.
        Match monday = match(5, "Jornada 13", saturday.plus(2, ChronoUnit.DAYS));
        List<Match> league = List.of(first, nextRound, monday);
        Map<Long, Instant> locks = MatchdayLock.lockTimes(weekly, league, league);
        assertEquals(saturday, locks.get(4L));
        assertEquals(monday.getMatchDate(), locks.get(5L));
        assertEquals("Las predicciones de esta semana ya están cerradas",
                MatchdayLock.reason(weekly, nextRound, saturday.plus(1, ChronoUnit.HOURS)));
    }

    @Test
    void nflLeaguesLockByWeeksAndSaySo() {
        Edition nfl = edition(PredictionLockMode.PER_ROUND, 0);
        nfl.setCompetition(app.porrapp.model.Competition.builder().externalId("nfl").build());
        assertEquals("Las predicciones de esta semana ya están cerradas",
                MatchdayLock.reason(nfl, nextRound, saturday.plus(1, ChronoUnit.HOURS)));
        assertEquals("Las predicciones de esta jornada ya están cerradas",
                MatchdayLock.reason(edition(PredictionLockMode.PER_ROUND, 0), nextRound, saturday.plus(1, ChronoUnit.HOURS)));
    }

    private static Edition active() {
        return Edition.builder().poolFormat(PoolFormat.MATCH_DAY).status("ACTIVE").build();
    }

    @Test
    void anOpenMatchWithFutureDeadlineIsOpen() {
        Instant now = saturday.minus(1, ChronoUnit.HOURS);
        assertEquals(MatchdayLock.Closure.OPEN, MatchdayLock.closure(active(), first, saturday, now));
        assertEquals(MatchdayLock.Closure.OPEN, MatchdayLock.closure(active(), first, null, now));
        assertFalse(MatchdayLock.closure(null, first, saturday, now).isClosed());
    }

    @Test
    void theSameClosureRuleAppliesToListSaveSurvivorAndReveal() {
        Instant now = saturday;
        assertEquals(MatchdayLock.Closure.DEADLINE, MatchdayLock.closure(active(), first, saturday, now));
        assertTrue(MatchdayLock.closure(active(), first, saturday, now).isClosed());

        first.setFinished(true);
        assertEquals(MatchdayLock.Closure.FINISHED, MatchdayLock.closure(active(), first, null, now.minus(1, ChronoUnit.DAYS)));

        Match cancelled = match(9, "Jornada 12", saturday);
        cancelled.setStatus(app.porrapp.model.MatchStatusNormalized.CANCELLED);
        assertEquals(MatchdayLock.Closure.STATUS, MatchdayLock.closure(active(), cancelled, null, now.minus(1, ChronoUnit.DAYS)));

        Match postponed = match(10, "Jornada 12", saturday);
        postponed.setStatus(app.porrapp.model.MatchStatusNormalized.POSTPONED);
        assertEquals(MatchdayLock.Closure.OPEN, MatchdayLock.closure(active(), postponed, saturday, now.minus(1, ChronoUnit.DAYS)));
    }

    @Test
    void aClosedEditionClosesEveryMatchEvenWithoutDeadline() {
        Edition closed = Edition.builder().poolFormat(PoolFormat.MATCH_DAY).status("CLOSED").build();
        assertEquals(MatchdayLock.Closure.EDITION_LOCKED,
                MatchdayLock.closure(closed, nextRound, null, saturday.minus(30, ChronoUnit.DAYS)));
    }
}
