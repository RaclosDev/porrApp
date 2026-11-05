package com.porra.mundial.service;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
