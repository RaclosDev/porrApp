package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomLockServiceTest {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 5, 18, 0);

    private final MatchRepository matches = mock(MatchRepository.class);
    private final TeamRepository teams = mock(TeamRepository.class);
    private final CustomLockService service = new CustomLockService(matches, teams);
    private final Competition competition = Competition.builder().name("Copa").ownerLeague(new League()).build();
    private final List<Match> fixtures = new ArrayList<>();
    private long nextId = 1;

    @BeforeEach
    void setup() {
        competition.setId(9L);
        service.setClock(Clock.fixed(NOW.atZone(CustomLockService.ZONE).toInstant(), CustomLockService.ZONE));
        when(matches.findByCompetitionId(9L)).thenReturn(fixtures);
    }

    private Edition edition(PredictionLockMode mode, int offset) {
        return Edition.builder().competition(competition).poolFormat(PoolFormat.FULL_BRACKET)
                .lockMode(mode).lockOffsetMinutes(offset).build();
    }

    private Match match(String round, String group, String home, String away, LocalDateTime date) {
        Match match = Match.builder().id(nextId++).competition(competition).round(round).groupName(group)
                .homeTeam(Team.builder().name(home).build())
                .awayTeam(away == null ? null : Team.builder().name(away).build())
                .matchDate(date).finished(false).status(MatchStatusNormalized.SCHEDULED).build();
        fixtures.add(match);
        return match;
    }

    @Test
    void perMatchLocksEachWinnerWhenItsMatchStarts() {
        match("bracket-1", null, "A", "B", NOW.minusHours(1));
        match("bracket-1", null, "C", "D", NOW.plusDays(1));

        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));

        assertEquals(List.of(List.of(true, false), List.of(false)), state.picks());
        assertTrue(state.anyLocked());
        assertFalse(state.fullyLocked());
        assertEquals(NOW.plusDays(1), state.nextLockAt());
    }

    @Test
    void removingAnEarlierFixtureShiftsTheLockedPickIndex() {
        Match future = match("bracket-2", null, "A", "C", NOW.plusDays(1));
        match("bracket-2", null, "B", "D", NOW.minusHours(1));
        for (int index = 0; index < 4; index++) {
            match("bracket-1", null, "H" + index, "A" + index, NOW.plusDays(1));
        }
        Edition edition = edition(PredictionLockMode.PER_MATCH, 0);

        assertEquals(List.of(false, true), service.state(edition).picks().get(1));
        assertEquals(List.of(true, false), service.stateWithoutMatch(edition, future.getId()).picks().get(1));
    }

    @Test
    void perRoundLocksTheWholeRoundAndGroupsWithTheMargin() {
        match("group", "A", "A", "B", NOW.plusMinutes(90));
        match("group", "B", "C", "D", NOW.plusDays(3));
        match("bracket-1", null, "A", "C", NOW.plusMinutes(30));
        match("bracket-1", null, "B", "D", NOW.plusDays(2));

        var state = service.state(edition(PredictionLockMode.PER_ROUND, 120));

        assertEquals(List.of("A"), state.groups());
        assertEquals(List.of(true, true), state.picks().get(0));
        assertFalse(state.pickLocked(1, 0));
        assertEquals(NOW.plusDays(3).minusMinutes(120), state.nextLockAt());
    }

    @Test
    void byesNeverBlockTheFullLock() {
        match("bracket-1", null, "A", "B", NOW.minusDays(3));
        match("bracket-1", null, "C", "D", NOW.minusDays(3));
        match("bracket-1", null, "E", null, null);
        match("bracket-2", null, "A", "C", NOW.minusDays(2));
        match("bracket-3", null, "A", "E", NOW.minusDays(1));

        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));

        assertFalse(state.pickLocked(0, 2));
        assertFalse(state.pickLocked(1, 1));
        assertTrue(state.fullyLocked());
        assertNull(state.nextLockAt());
    }

    @Test
    void aGroupWithoutFixturesRemainsOpenAfterTheBracketCloses() {
        when(teams.findByCompetitionIdOrderByNameAsc(9L)).thenReturn(List.of(
                Team.builder().name("A").groupName("A").build(),
                Team.builder().name("B").groupName("A").build()));
        match("bracket-1", null, "A", "B", NOW.minusDays(1));

        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));

        assertTrue(state.anyLocked());
        assertFalse(state.fullyLocked());
        assertFalse(state.groupLocked("A"));
    }

    @Test
    void aFinishedOrLiveMatchLocksEvenWithoutADate() {
        match("bracket-1", null, "A", "B", null).setStatus(MatchStatusNormalized.LIVE);
        match("bracket-1", null, "C", "D", null).setFinished(true);

        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));

        assertEquals(List.of(true, true), state.picks().get(0));
    }

    @Test
    void fixedDateLocksEverythingAtOnce() {
        match("group", "A", "A", "B", NOW.plusDays(1));
        match("bracket-1", null, "A", "B", NOW.plusDays(2));
        Edition edition = edition(PredictionLockMode.FIXED_DATE, 0);
        edition.setLockDate(NOW.minusMinutes(1));

        var state = service.state(edition);

        assertTrue(state.fullyLocked());
        assertEquals(List.of("A"), state.groups());
    }

    @Test
    void firstMatchLockIgnoresByesAndAppliesTheMargin() {
        match("bracket-1", null, "E", null, NOW.plusHours(1));
        match("bracket-1", null, "A", "B", NOW.plusDays(2));
        assertEquals(NOW.plusDays(2).minusDays(1), service.firstMatchLock(edition(PredictionLockMode.FIRST_MATCH, 24 * 60)));
    }

    @Test
    void lockedPartsCannotChangeButOpenOnesCan() {
        match("bracket-1", null, "A", "B", NOW.minusHours(1));
        match("bracket-1", null, "C", "D", NOW.plusDays(1));
        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));
        PredictionDataDTO saved = bracket(List.of(List.of("A", "C"), List.of("A")), "A");

        assertDoesNotThrow(() -> service.requireLockedPartsUnchanged(state, saved,
                bracket(List.of(List.of("A", "D"), List.of("D")), "D")));
        assertThrows(BusinessException.class, () -> service.requireLockedPartsUnchanged(state, saved,
                bracket(List.of(List.of("B", "C"), List.of("B")), "B")));
    }

    @Test
    void othersOnlySeeWhatIsAlreadyLocked() {
        match("group", "A", "A", "B", NOW.minusHours(2));
        match("group", "B", "C", "D", NOW.plusDays(1));
        match("bracket-1", null, "A", "C", NOW.minusHours(1));
        match("bracket-1", null, "B", "D", NOW.plusDays(2));
        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));
        PredictionDataDTO data = bracket(List.of(List.of("A", "D"), List.of("A")), "A");
        data.setGroups(Map.of("A", List.of("A", "B"), "B", List.of("D", "C")));

        PredictionDataDTO visible = service.lockedPartsOnly(state, data);

        assertEquals(Map.of("A", List.of("A", "B")), visible.getGroups());
        assertEquals(java.util.Arrays.asList("A", null), visible.getCustomRounds().get(0));
        assertNull(visible.getChampion());
        assertEquals(List.of(List.of("A", "D"), List.of("A")), data.getCustomRounds());
    }

    private static PredictionDataDTO bracket(List<List<String>> rounds, String champion) {
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(rounds);
        data.setChampion(champion);
        return data;
    }
}
