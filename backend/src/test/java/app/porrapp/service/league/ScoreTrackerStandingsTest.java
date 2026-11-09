package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerDTO.Standing;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ScoreTrackerStandingsTest {

    private static final List<Player> PLAYERS = List.of(new Player(1L, "Ana"), new Player(2L, "Berto"), new Player(3L, "Carla"));

    @Test
    void ranksByTotalAndCountsRoundsWon() {
        List<Standing> standings = ScoreTrackerStandings.rank(PLAYERS, false,
                List.of(Map.of(1L, 3, 2L, 5, 3L, 1), Map.of(1L, 4, 2L, 0, 3L, 2)), Map.of());

        assertThat(standings).extracting(Standing::playerId).containsExactly(1L, 2L, 3L);
        assertThat(standings).extracting(Standing::total).containsExactly(7, 5, 3);
        assertThat(standings).extracting(Standing::roundsWon).containsExactly(1, 1, 0);
    }

    @Test
    void tiesShareRankAndSkipTheNext() {
        List<Standing> standings = ScoreTrackerStandings.rank(PLAYERS, false,
                List.of(Map.of(1L, 5, 2L, 5, 3L, 1)), Map.of());

        assertThat(standings).extracting(Standing::rank).containsExactly(1, 1, 3);
        assertThat(standings).extracting(Standing::roundsWon).containsExactly(1, 1, 0);
    }

    @Test
    void lowerWinsInvertsTheOrder() {
        List<Standing> standings = ScoreTrackerStandings.rank(PLAYERS, true,
                List.of(Map.of(1L, 30, 2L, 10, 3L, 20)), Map.of());

        assertThat(standings).extracting(Standing::playerId).containsExactly(2L, 3L, 1L);
        assertThat(standings.get(0).roundsWon()).isEqualTo(1);
    }

    @Test
    void missingPlayersCountAsZero() {
        List<Standing> standings = ScoreTrackerStandings.rank(PLAYERS, false, List.of(Map.of(2L, 4)), Map.of());

        assertThat(standings.get(0).playerId()).isEqualTo(2L);
        assertThat(standings).extracting(Standing::total).containsExactly(4, 0, 0);
    }

    @Test
    void overallStandingsCarrySessionsWon() {
        List<Standing> standings = ScoreTrackerStandings.rank(PLAYERS, false, List.of(), Map.of(1L, 10));

        assertThat(standings).filteredOn(s -> s.playerId().equals(1L)).extracting(Standing::sessionsWon).containsExactly(10);
    }

    @Test
    void noLeadersBeforeTheFirstRound() {
        List<Standing> empty = ScoreTrackerStandings.rank(PLAYERS, false, List.of(), Map.of());
        assertThat(ScoreTrackerStandings.leaders(empty, 0)).isEmpty();

        List<Standing> played = ScoreTrackerStandings.rank(PLAYERS, false, List.of(Map.of(1L, 2, 2L, 2, 3L, 0)), Map.of());
        assertThat(ScoreTrackerStandings.leaders(played, 1)).containsExactlyInAnyOrder(1L, 2L);
    }
}
