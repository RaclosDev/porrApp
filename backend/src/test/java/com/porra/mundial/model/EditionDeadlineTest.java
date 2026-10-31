package com.porra.mundial.model;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class EditionDeadlineTest {
    @Test
    void bothBracketFormatsUseTheExistingTournamentDeadlineButMatchdayDoesNot() {
        Competition cup = Competition.builder().externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        LocalDateTime deadline = LocalDateTime.of(2026, 6, 11, 20, 0);
        assertEquals(deadline, Edition.defaultLockDate(cup, PoolFormat.FULL_BRACKET));
        assertEquals(deadline, Edition.defaultLockDate(cup, PoolFormat.KNOCKOUTS_ONLY));
        assertEquals(deadline, Edition.defaultLockDate(cup, null));
        assertNull(Edition.defaultLockDate(cup, PoolFormat.MATCH_DAY));
        assertNull(Edition.defaultLockDate(null, PoolFormat.FULL_BRACKET));
        assertNull(Edition.defaultLockDate(Competition.builder().externalId("esp.1").build(), PoolFormat.MATCH_DAY));
    }

    @Test
    void closesAtTheExactMadridDeadlineIndependentOfHostTimezone() {
        Edition edition = Edition.builder().lockDate(LocalDateTime.of(2026, 6, 11, 20, 0)).build();
        assertFalse(edition.isLocked(at("2026-06-11T17:59:59Z")));
        assertTrue(edition.isLocked(at("2026-06-11T18:00:00Z")));
        assertTrue(edition.isLocked(at("2026-07-20T12:00:00Z")));
    }

    @Test
    void archivedEditionIsClosedAndMatchdayWithoutEditionDeadlineRemainsOpen() {
        Edition edition = Edition.builder().poolFormat(PoolFormat.MATCH_DAY).build();
        assertFalse(edition.isLocked(at("2026-07-20T12:00:00Z")));
        edition.setStatus("ARCHIVED");
        assertTrue(edition.isLocked(at("2026-07-20T12:00:00Z")));
    }

    private static Clock at(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneOffset.UTC);
    }
}
