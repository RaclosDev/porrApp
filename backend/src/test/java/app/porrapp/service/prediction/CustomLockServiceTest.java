package app.porrapp.service.prediction;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Team;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomLockServiceTest {
    private static final Instant NOW = AppTime.fromLocal(LocalDateTime.of(2026, 11, 5, 18, 0));

    private final MatchRepository matches = mock(MatchRepository.class);
    private final TeamRepository teams = mock(TeamRepository.class);
    private final EditionRepository editions = mock(EditionRepository.class);
    private final CompetitionTeamRepository competitionTeams = mock(CompetitionTeamRepository.class);
    private final CustomLockService service = new CustomLockService(matches, teams, competitionTeams, editions);
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

    private Match match(String round, String group, String home, String away, Instant date) {
        Match match = Match.builder().id(nextId++).competition(competition).round(round).groupName(group)
                .homeTeam(Team.builder().name(home).build())
                .awayTeam(away == null ? null : Team.builder().name(away).build())
                .matchDate(date).finished(false).status(MatchStatusNormalized.SCHEDULED).build();
        fixtures.add(match);
        return match;
    }

    @Test
    void perMatchLocksEachWinnerWhenItsMatchStarts() {
        match("bracket-1", null, "A", "B", NOW.minus(1, ChronoUnit.HOURS));
        match("bracket-1", null, "C", "D", NOW.plus(1, ChronoUnit.DAYS));

        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));

        assertEquals(List.of(List.of(true, false), List.of(false)), state.picks());
        assertTrue(state.anyLocked());
        assertFalse(state.fullyLocked());
        assertEquals(NOW.plus(1, ChronoUnit.DAYS), state.nextLockAt());
    }

    @Test
    void removingAnEarlierFixtureShiftsTheLockedPickIndex() {
        Match future = match("bracket-2", null, "A", "C", NOW.plus(1, ChronoUnit.DAYS));
        match("bracket-2", null, "B", "D", NOW.minus(1, ChronoUnit.HOURS));
        for (int index = 0; index < 4; index++) {
            match("bracket-1", null, "H" + index, "A" + index, NOW.plus(1, ChronoUnit.DAYS));
        }
        Edition edition = edition(PredictionLockMode.PER_MATCH, 0);

        assertEquals(List.of(false, true), service.state(edition).picks().get(1));
        assertEquals(List.of(true, false), service.stateWithoutMatch(edition, future.getId()).picks().get(1));
    }

    @Test
    void perRoundLocksTheWholeRoundAndGroupsWithTheMargin() {
        match("group", "A", "A", "B", NOW.plus(90, ChronoUnit.MINUTES));
        match("group", "B", "C", "D", NOW.plus(3, ChronoUnit.DAYS));
        match("bracket-1", null, "A", "C", NOW.plus(30, ChronoUnit.MINUTES));
        match("bracket-1", null, "B", "D", NOW.plus(2, ChronoUnit.DAYS));

        var state = service.state(edition(PredictionLockMode.PER_ROUND, 120));

        assertEquals(List.of("A"), state.groups());
        assertEquals(List.of(true, true), state.picks().get(0));
        assertFalse(state.pickLocked(1, 0));
        assertEquals(NOW.plus(3, ChronoUnit.DAYS).minus(120, ChronoUnit.MINUTES), state.nextLockAt());
    }

    @Test
    void byesNeverBlockTheFullLock() {
        match("bracket-1", null, "A", "B", NOW.minus(3, ChronoUnit.DAYS));
        match("bracket-1", null, "C", "D", NOW.minus(3, ChronoUnit.DAYS));
        match("bracket-1", null, "E", null, null);
        match("bracket-2", null, "A", "C", NOW.minus(2, ChronoUnit.DAYS));
        match("bracket-3", null, "A", "E", NOW.minus(1, ChronoUnit.DAYS));

        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));

        assertFalse(state.pickLocked(0, 2));
        assertFalse(state.pickLocked(1, 1));
        assertTrue(state.fullyLocked());
        assertNull(state.nextLockAt());
    }

    @Test
    void aGroupWithoutFixturesRemainsOpenAfterTheBracketCloses() {
        when(teams.findByCompetitionIdOrderByNameAsc(9L)).thenReturn(List.of(
                Team.builder().id(1L).name("A").build(),
                Team.builder().id(2L).name("B").build()));
        when(competitionTeams.groupByTeamId(9L)).thenReturn(Map.of(1L, "A", 2L, "A"));
        match("bracket-1", null, "A", "B", NOW.minus(1, ChronoUnit.DAYS));

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
        match("group", "A", "A", "B", NOW.plus(1, ChronoUnit.DAYS));
        match("bracket-1", null, "A", "B", NOW.plus(2, ChronoUnit.DAYS));
        Edition edition = edition(PredictionLockMode.FIXED_DATE, 0);
        edition.setLockDate(NOW.minus(1, ChronoUnit.MINUTES));

        var state = service.state(edition);

        assertTrue(state.fullyLocked());
        assertEquals(List.of("A"), state.groups());
    }

    @Test
    void firstMatchLockIgnoresByesAndAppliesTheMargin() {
        match("bracket-1", null, "E", null, NOW.plus(1, ChronoUnit.HOURS));
        match("bracket-1", null, "A", "B", NOW.plus(2, ChronoUnit.DAYS));
        assertEquals(NOW.plus(2, ChronoUnit.DAYS).minus(1, ChronoUnit.DAYS), service.firstMatchLock(edition(PredictionLockMode.FIRST_MATCH, 24 * 60)));
    }

    @Test
    void lockedPartsCannotChangeButOpenOnesCan() {
        match("bracket-1", null, "A", "B", NOW.minus(1, ChronoUnit.HOURS));
        match("bracket-1", null, "C", "D", NOW.plus(1, ChronoUnit.DAYS));
        var state = service.state(edition(PredictionLockMode.PER_MATCH, 0));
        PredictionDataDTO saved = bracket(List.of(List.of("A", "C"), List.of("A")), "A");

        assertDoesNotThrow(() -> service.requireLockedPartsUnchanged(state, saved,
                bracket(List.of(List.of("A", "D"), List.of("D")), "D")));
        assertThrows(BusinessException.class, () -> service.requireLockedPartsUnchanged(state, saved,
                bracket(List.of(List.of("B", "C"), List.of("B")), "B")));
    }

    @Test
    void othersOnlySeeWhatIsAlreadyLocked() {
        match("group", "A", "A", "B", NOW.minus(2, ChronoUnit.HOURS));
        match("group", "B", "C", "D", NOW.plus(1, ChronoUnit.DAYS));
        match("bracket-1", null, "A", "C", NOW.minus(1, ChronoUnit.HOURS));
        match("bracket-1", null, "B", "D", NOW.plus(2, ChronoUnit.DAYS));
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

    @Test
    void officialBracketPlacesLaterMatchesNextToTheirFirstRoundMatches() {
        Competition worlds = Competition.builder().id(19L).externalId("lol.worlds").formatType("TOURNAMENT").build();
        List<Match> official = new ArrayList<>();
        String[][] pairs = {{"IG", "TES"}, {"GEN", "LYON"}, {"DK", "BLG"}, {"T1", "KC"}};
        for (int index = 0; index < 4; index++) {
            official.add(Match.builder().id(100L + index).competition(worlds).round("qf")
                    .homeTeam(Team.builder().name(pairs[index][0]).build())
                    .awayTeam(Team.builder().name(pairs[index][1]).build())
                    .matchDate(NOW.minus(4 - index, ChronoUnit.DAYS)).finished(true).status(MatchStatusNormalized.FINISHED).build());
        }
        // La segunda semifinal (DK - T1) empieza antes que la primera.
        official.add(Match.builder().id(200L).competition(worlds).round("sf")
                .homeTeam(Team.builder().name("DK").build()).awayTeam(Team.builder().name("T1").build())
                .matchDate(NOW.minus(1, ChronoUnit.HOURS)).finished(false).status(MatchStatusNormalized.SCHEDULED).build());
        official.add(Match.builder().id(201L).competition(worlds).round("sf")
                .homeTeam(Team.builder().name("IG").build()).awayTeam(Team.builder().name("GEN").build())
                .matchDate(NOW.plus(1, ChronoUnit.DAYS)).finished(false).status(MatchStatusNormalized.SCHEDULED).build());
        // Fase suiza: no se pronostica y no debe contar como grupo.
        official.add(Match.builder().id(300L).competition(worlds).round("group").groupName("Swiss")
                .homeTeam(Team.builder().name("A").build()).awayTeam(Team.builder().name("B").build())
                .matchDate(NOW.minus(10, ChronoUnit.DAYS)).finished(true).build());
        when(matches.findByCompetitionId(19L)).thenReturn(official);
        Edition edition = Edition.builder().competition(worlds).poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(PredictionLockMode.PER_MATCH).build();

        var state = service.state(edition);

        assertEquals(List.of(List.of(true, true, true, true), List.of(false, true), List.of(false)), state.picks());
        assertEquals(List.of(), state.groups());
        assertEquals(NOW.plus(1, ChronoUnit.DAYS), state.nextLockAt());
    }

    @Test
    void refreshMovesOnlyFutureFirstMatchLocksOfOfficialLeagues() {
        Competition worlds = Competition.builder().id(19L).externalId("lol.worlds").formatType("TOURNAMENT").build();
        when(matches.findByCompetitionId(19L)).thenReturn(List.of(
                Match.builder().id(1L).competition(worlds).round("group").matchDate(NOW.plus(1, ChronoUnit.HOURS))
                        .homeTeam(Team.builder().name("A").build()).awayTeam(Team.builder().name("B").build()).build(),
                Match.builder().id(2L).competition(worlds).round("qf").matchDate(NOW.plus(2, ChronoUnit.DAYS))
                        .homeTeam(Team.builder().name("T1").build()).awayTeam(Team.builder().name("KC").build()).build()));
        Edition open = Edition.builder().competition(worlds).poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(PredictionLockMode.FIRST_MATCH).lockOffsetMinutes(30).lockDate(NOW.plus(5, ChronoUnit.DAYS)).build();
        Edition closed = Edition.builder().competition(worlds).poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(PredictionLockMode.FIRST_MATCH).lockDate(NOW.minus(1, ChronoUnit.HOURS)).build();
        Edition fixed = Edition.builder().competition(worlds).poolFormat(PoolFormat.KNOCKOUTS_ONLY)
                .lockMode(PredictionLockMode.FIXED_DATE).lockDate(NOW.plus(5, ChronoUnit.DAYS)).build();
        when(editions.findByCompetitionIdAndStatus(19L, "ACTIVE")).thenReturn(List.of(open, closed, fixed));

        service.refreshFirstMatchLocks(19L);

        assertEquals(NOW.plus(2, ChronoUnit.DAYS).minus(30, ChronoUnit.MINUTES), open.getLockDate());
        assertEquals(NOW.minus(1, ChronoUnit.HOURS), closed.getLockDate());
        assertEquals(NOW.plus(5, ChronoUnit.DAYS), fixed.getLockDate());
    }
}
