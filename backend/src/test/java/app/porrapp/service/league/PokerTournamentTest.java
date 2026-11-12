
package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.model.PokerSession;
import app.porrapp.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PokerTournamentTest {
    @Test
    void closesWithStacksAndSharesTiedPrizesWithoutLosingCents() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(
                Action.CLOSE, 0L, null, List.of(
                new FinalStack(1, 150),
                new FinalStack(2, 150))), 1000);
        var result = PokerTournament.view(session, 1000);
        assertThat(result.closedAt()).isEqualTo(1000);
        assertThat(result.clock().endsAt()).isNull();
        assertThat(result.results()).extracting(Result::place).containsExactly(1, 1, 3);
        assertThat(result.results()).extracting(Result::finalChips).containsExactly(150L, 150L, 0L);
        assertThat(result.results().stream().mapToLong(Result::prizeCents).sum()).isEqualTo(303);
    }

    @Test
    void ranksSurvivorsByChipsAndKeepsEliminatedPlaces() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(
                Action.CLOSE, 0L, null, List.of(
                new FinalStack(1, 100),
                new FinalStack(2, 200))), 1000);
        assertThat(PokerTournament.view(session, 1000).results())
                .extracting(Result::playerId).containsExactly(2L, 1L, 3L);
    }

    @Test
    void rejectsMissingDuplicateAndIncorrectStackTotals() {
        for (var stacks : List.of(
                List.of(new FinalStack(1, 300)),
                List.of(new FinalStack(1, 150), new FinalStack(1, 150)),
                List.of(new FinalStack(1, 100), new FinalStack(2, 100)))) {
            var session = activeSession();
            assertThatThrownBy(() -> PokerTournament.apply(session,
                    new Command(Action.CLOSE, 0L, null, stacks), 1000))
                    .isInstanceOf(BusinessException.class);
            assertThat(session.getClosedAt()).isNull();
        }
    }

    @Test
    void rebuysWithoutLimitKeepGoingAndLimitedOnesStop() {
        var unlimited = activeSession();
        unlimited.setSettings(new Settings(101, 100, new Extra(100, 100, null, 1), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        for (int i = 0; i < 25; i++) {
            PokerTournament.apply(unlimited, new Command(Action.REBUY, 0L, 1L), 1000);
        }
        assertThat(unlimited.getEntries().getFirst().rebuys()).isEqualTo(25);

        var limited = activeSession();
        limited.setSettings(new Settings(101, 100, new Extra(100, 100, 2, 1), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        PokerTournament.apply(limited, new Command(Action.REBUY, 0L, 1L), 1000);
        PokerTournament.apply(limited, new Command(Action.REBUY, 0L, 1L), 1000);
        assertThatThrownBy(() -> PokerTournament.apply(limited, new Command(Action.REBUY, 0L, 1L), 1000))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void anyEliminationCanBeUndoneAndARebuyBringsThePlayerBack() {
        var session = activeSession();
        session.setSettings(new Settings(101, 100, new Extra(100, 100, null, 1), null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        PokerTournament.apply(session, new Command(Action.ELIMINATE, 0L, 1L), 1000);

        PokerTournament.apply(session, new Command(Action.UNDO_ELIMINATION, 0L, 3L), 1000);
        assertThat(session.getEliminations()).containsExactly(1L);
        assertThatThrownBy(() -> PokerTournament.apply(session, new Command(Action.UNDO_ELIMINATION, 0L, 3L), 1000))
                .isInstanceOf(BusinessException.class);

        PokerTournament.apply(session, new Command(Action.REBUY, 0L, 1L), 1000);
        assertThat(session.getEliminations()).isEmpty();
        assertThat(session.getEntries().getFirst().rebuys()).isEqualTo(1);
    }

    @Test
    void prizesCanBeChangedDuringTheTournament() {
        var session = activeSession();
        PokerTournament.apply(session, new Command(Action.SET_PRIZES, 0L, null, null, List.of(50, 30, 20)), 1000);
        assertThat(session.getSettings().prizeShares()).containsExactly(50, 30, 20);
        assertThat(PokerTournament.view(session, 1000).prizes()).containsExactly(153L, 90L, 60L);
        for (var shares : List.of(List.of(60, 30), List.of(40, 30, 20, 10))) {
            assertThatThrownBy(() -> PokerTournament.apply(session,
                    new Command(Action.SET_PRIZES, 0L, null, null, shares), 1000))
                    .isInstanceOf(BusinessException.class);
        }
        assertThat(session.getSettings().prizeShares()).containsExactly(50, 30, 20);
    }

    private PokerSession activeSession() {
        var session = new PokerSession();
        session.setId(1L);
        session.setStartedAt(1L);
        session.setSettings(new Settings(101, 100, null, null,
                List.of(70, 30), List.of(new BlindLevel(10, 1, 2, 0))));
        session.setEntries(List.of(new Entry(1, "Ana", 0, 0),
                new Entry(2, "Luis", 0, 0), new Entry(3, "Paz", 0, 0)));
        session.setEliminations(List.of(3L));
        session.setBlindClock(new BlindClock(0, 600001L, 600000));
        return session;
    }

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
