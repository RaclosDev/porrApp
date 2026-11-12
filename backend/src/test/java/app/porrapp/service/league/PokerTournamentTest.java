
package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.BlindClock;
import app.porrapp.dto.PokerDTO.BlindLevel;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PokerTournamentTest {
    @Test
    void clockAdvancesAcrossBreaksEvenWithNoClientConnected() {
        var levels = List.of(new BlindLevel(1, 25, 50, 0), new BlindLevel(2, 0, 0, 0),
                new BlindLevel(1, 50, 100, 10));
        var started = new BlindClock(0, 60_000L, 60_000L);
        assertThat(PokerTournament.clockAt(started, levels, 60_000)).isEqualTo(new BlindClock(1, 180_000L, 120_000));
        assertThat(PokerTournament.clockAt(started, levels, 181_000)).isEqualTo(new BlindClock(2, 240_000L, 59_000));
        assertThat(PokerTournament.clockAt(started, levels, 250_000)).isEqualTo(new BlindClock(2, null, 0));
        var paused = new BlindClock(1, null, 1000);
        assertThat(PokerTournament.clockAt(paused, levels, 250_000)).isEqualTo(paused);
    }

    @Test
    void allCentsArePaidEvenWhenPercentagesRoundDown() {
        assertThat(PokerTournament.prizes(8027, List.of(60, 30, 10))).containsExactly(4817L, 2408L, 802L);
    }
}
